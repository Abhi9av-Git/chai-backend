import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js'
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from '../utils/ApiResponse.js'

const generateAccessAndRefreshTokens=async(userId)=> {
  try {
    const user=await User.findById(userId)
    const accessToken=await user.generateAccessToken()
    const refreshToken=await user.generateRefreshToken()

    user.refreshToken=refreshToken
    await user.save({validateBeforeSave: false})

    return {accessToken, refreshToken}
  }
  catch (error) {
    throw new ApiError(500, "Error generating access and refresh tokens")
  }
}

const registerUser= asyncHandler(async(req, res)=> {
  //1 get user details from frontend
  //2 validation - not empty
  //3 check if user already exists: check using username or email
  //4 check for images, check for avatar
  //5 upload them to cloudinary, avatar
  //6 create user object - create entry in db
  //7 remove password and refresh token field from response
  //8 check for user creation
  //9 return response (res)

  // 1
  const {fullName, email, username, password}=req.body
  //console.log("email", email);

  //2 
  if (fullName==="") {
    throw new ApiError(400, "Full name is required")
  }

  if (email==="") {
    throw new ApiError(400, "Email is required")
  }

  if (username==="") {
    throw new ApiError(400, "username is required")
  }

  if (password==="") {
    throw new ApiError(400, "Password is required")
  }

  //3 
  const existingUser=await User.findOne({
    $or: [
      {email: email},
      {username: username}
    ]
  })

  if (existingUser) {
    throw new ApiError(409, "User already exists with the given email or username")
  }

  console.log(req.files);

  //4
  const avatarLocalPath=req.files?.avatar[0]?.path;
  // const coverImageLocalPath=req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0) {
    coverImageLocalPath=req.files.coverImage[0].path
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar image is required")
  }

  //5
  const avatar=await uploadOnCloudinary(avatarLocalPath)
  const coverImage=await uploadOnCloudinary(coverImageLocalPath)

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required")
  }

  //6
  const user=await User.create({
    fullName,
    email,
    username: username.toLowerCase(),
    avatar: avatar.url, // no need for secure_url in avatar as it is already checked
    coverImage: coverImage?.url || "",
    password
  })

  //7
  const createdUser=await User.findById(user._id).select(
    "-password -refreshToken"
  )

  //8
  if (!createdUser) {
    throw new ApiError(500, "User creation failed")
  }

  //9
  return res.status(201).json(
    new ApiResponse(200, createdUser, "User registered successfully")
  )

})

const loginUser=asyncHandler(async(req, res)=> {
  //1 get user credentials from frontend i.e username/email and password
  const {username, email, password}=req.body

  if (!username && !email) {
    throw new ApiError(400, "Username or email is required")
  }

  //2 check if password is empty
  if (!password) {
    throw new ApiError(400, "Password is required")
  }

  //3 check if user exists with the given username
  const user=await User.findOne({
    $or: [
      {username},
      {email}
    ]
  })

  if (!user) {
    throw new ApiError(404, "User not found with the given username")
  }
  
  //4 if User exists, check if password is correct
  const isPasswordValid=await user.isPasswordCorrect(password)

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid password")
  }

  const {accessToken, refreshToken} =await generateAccessandRefreshTokens(user._id)

  const loggedInUser=await User.findById(user._id).select(
    "-password -refreshToken"
  )

  // send cookies
  const cookieOptions={
    httpOnly: true,
    secure: true
  }

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200, 
        {
          user: loggedInUser, accessToken, refreshToken
        },  
        "User Logged in successfully"
      )
    )

})

const logoutUser=asyncHandler(async(req, res)=> {
  //1 get user id from request
  await User.findByIdAndUpdate(req.user._id, 
    {
      $unset: {
        refreshToken: 1 // this removes the field from document
      }
    },
    {
      new: true
    }
  )

  const cookieOptions={
    httpOnly: true,
    secure: true
  }

  return res
  .status(200)
  .clearCookie("accessToken", cookieOptions)
  .clearCookie("refreshToken", cookieOptions)
  .json(new ApiResponse(200, {}, "User logged out status successfuly"))
})

const refreshAccessToken=asyncHandler(async(req, res)=> {
  const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request")
  }

  try {
    const decodedToken=jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    )

    const user=await User.findById(decodedToken?._id)

    if (!user) {
      throw new ApiError(401, "Invalid refresh token")
    }

    if (incomingRefreshToken!==user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used")
    }

    const options={
      httpOnly: true,
      secure: true
    }

    const {accessToken, newRefreshToken}=await generateAccessAndRefreshTokens(user._id)

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken), options
    .json(
      new ApiResponse(
        200, 
        {
          accessToken,
          refreshToken: newRefreshToken
        },
        "Access Token refreshed successfully"
      )
    )
  }
  catch(error) {
    throw new ApiError(401, error?.message || "Incoming resfreshToken is invalid")
  }
})

const changeCurrentPassword=asyncHandler(async(req, res)=> {
  const {oldPassword, newPassword}=req.body

  const user=await User.findById(req.user?._id)
  user.isPasswordCorrect(oldPassword)

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password")
  }

  user.password=newPassword
  await user.save({validateBeforeSave: false})

  return res
  .status(200)
  .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser=asyncHandler(async(req, res)=> {
  return res
  .status(200)
  .json(200, req.user, "Current user fetched successfully")
})

const updateAccountDetails=asyncHandler(async(req, res)=> {
  const{fullName, email}=req.body

  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required")
  }

  User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email: email
      }
    },
    {new: true}
  ).select("-password")

  return res
  .status(200)
  .json(new ApiResponse(200, {}, "Account details updated successfully"))
})

const updateUserAvatar=asyncHandler(async(req, res)=> {
  const avatarLocalPath=req.files?.path

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing")
  }

  const avatar=await uploadOnCloudinary(avatarLocalPath)

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading avatar")
  }

  const user=await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url
      }
    },
    {new: true}
  ).select("-password")

  return res
  .status(200)
  .json(
    new ApiResponse(200, user, "Avatar updated successfully")
  )
})

const updateUserCoverImage=asyncHandler(async(req, res)=> {
  const coverImageLocalPath=req.files?.path

  if (!coverImageLocalPath) {
    throw new ApiError(400, "cover Image file is missing")
  }

  const coverImage=await uploadOnCloudinary(coverImageLocalPath)

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading cover Image")
  }

  const user=await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url
      }
    },
    {new: true}
  ).select("-password")

  return res
  .status(200)
  .json(
    new ApiResponse(200, user, "Cover Image updated successfully")
  )
})

const getUserChannelProfile=asyncHandler(async(req, res)=> {
  const {username}=req.params

  if (!username?.trim()) {
    throw new ApiError(400, "username is missing")
  }

  const channel=await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase()
      }
    },
    {
      $lookup : {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers"  // no. of subscribers
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo"  // To How many I have subscribed
      }
    },
    {
      $addField: {
        subscribersCount: {
          $size: "$subscribers"
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo"
        },
        isSubscribed: {
          $cond: {
            if: {$in: [req.user?._id, "$subscribers.subscriber"]},
            then: true,
            else: false
          }
        }
      }
    },
    {
      $project: {
        fullname: 1,
        username: 1,
        subscriberCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1
      }
    }
  ])

  if (!channel?.length) {
    throw new ApiError(404, "channel does not exists")
  }

  return res
  .status(200)
  .json(
    new ApiResponse(200, channel[0], "Usre channel fetched successfully")
  )
})

const getWatchHistory=asyncHandler(async(req, res)=> {
  const user= await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id)
      }
    },
    {
      $lookup: {
        from: "videos", 
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            lookup: {
              from: "users",
              localField: "owner",
              foreignField: _id,
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    userName: 1,
                    avatar: 1
                  }
                }
              ]
            }
          },
          {
            $addFields: {
              owner: {
                $first: "$owner"
              }
            }
          }
        ]
      }
    }
  ])

  return res
  .status(200)
  .json(
    new ApiResponse(
      200, 
      user[0].watchHistory,
      "Watch history fetched successfully"
    )
  )
})

export {
  registerUser, 
  loginUser, 
  logoutUser, 
  refreshAccessToken, 
  changeCurrentPassword, 
  getCurrentUser, 
  updateAccountDetails, 
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory
} 
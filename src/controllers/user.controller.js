import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js'
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from '../utils/ApiResponse.js'

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

export {registerUser} 
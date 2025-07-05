// const asyncHandler=(requestHandler)=>{
  // (req, res, next)=> {
    // Promise.resolve(requestHandler(req, res, next)).
    // catch((err)=>next(err))
  // }
// }

const asyncHandler=(fn)=>async(req, res, next)=> {
  try{
    await fn(req, res, next)
    // If the function resolves successfully it will continue to the next middleware
  }
  catch(error){
    res.status(error.code || 500).json({
      success: false,
      message: error.message
    })
  }
}

export {asyncHandler}


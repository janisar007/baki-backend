import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {User} from "../models/user.model.js"
// import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken" 
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user = await User.findOne(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}
    } catch (error) {
        throw new ApiError(500, "something went wrong while generating the tokens")
    }
}

const registerUser = asyncHandler(async(req, res) => {
    const {fullname, email, username, password} = req.body
    // console.log(req.body)
    // console.log("email: ", email)
    console.log(fullname)
    console.log(email)
    console.log(password)
    console.log(username)



    if(
        [fullname, email, username, password].some((field) => !field || field.trim() === "")
    ){
        throw new ApiError(400, "All fields are compelsory")
    }
    
    const existedUser = await User.findOne({
        $or: [{username}, {email}]
    })

    if(existedUser){
        throw new ApiError(409, "username or email already exists")
    }


    // const avatarLocalPath = req.files?.avatar[0]?.path;

    
    // let avatarLocalPath;
    // if(req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0) {
    //     avatarLocalPath = req.files.avatar[0].path

    // }

    // let coverImagePath;
    // if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    //     coverImagePath = req.files.coverImage[0].path

    // }

    // if(!avatarLocalPath){

    //     throw new ApiError(400, "Avatar file is required");
    // }

    
    // const avatar = await uploadOnCloudinary(avatarLocalPath)
    // const coverImage = await uploadOnCloudinary(coverImagePath)

    // if(!avatar){
    //     throw new ApiError(400, "Avatar file is required")
    // }

    const user = await User.create({
        fullname, 
        email,
        password,
        username
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    if(!createdUser){
        throw new ApiError(500, "somethong went wrong while registering user")
    }

    console.log("user resistered successfully")
    
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )
    
})

const loginUser = asyncHandler(async(req, res) => {
    // reqbody -> data
    // username or email
    // find the user 
    // password check
    // access and refresh token
    // send cookies
    
    try {
        const {username, email, password} = req.body
        console.log(username)

        if(!(username || email)){
            throw new ApiError(400, "username or email missing")
        }

        const user = await User.findOne({
            $or : [{username}, {email}]
        })

        if(!user){
            throw new ApiError(402, "user is not registered")
        }

        const isPasswordValid = await user.isPasswordCorrect(password)

        if(!isPasswordValid){
            throw new ApiError(400, "Incorrect password")
        }

        const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

        const loggedInUser = await User.findOne(user._id).select("-password -refreshToken")

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
        }

        

        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken,options)
        .json(
            new ApiResponse(
                200,
                loggedInUser,
                "User logged in successfully"
            )
        )
        
    } catch (error) {
        console.log(error)
    }

    

})

const logoutUser = asyncHandler(async(req, res) => {
    // here we have user and we have to delete refreshToken from the user and save again 

    User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: { // which field i want empty just pass in unset operator and do flag 1
                refreshToken: 1
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse (
        200,
        {},
        "User logged Out successfully"
    ))
})

const refreshAccessToken = asyncHandler(async(req, res) => {
    const incomingRefreshToken =  req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
    
        if(!user){
            throw new ApiError(400, "Invalid refresh Token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const options = {
            httpOnly: false,
            secure: false 
        }
        const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)
        
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(
            200,
            {accessToken, refreshToken, user},
            "Access Token Refreshed successfully"
        ))
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh Token")
    }
})

const changeCurrentPassword = asyncHandler(async(req, res) =>{
    const {oldPassword, newPassword} = req.body
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        {},
        "Password changed successfully"
    ))
})

const getCurrentUser = asyncHandler(async(req, res) => {
    const currentUser = await User.findOne(req.user._id).select("-password -refreshToken")
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        currentUser,
        "Current user fatched successfully"
    ))
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullname, email} = req.body

    if(!fullname || !email){
        throw new ApiError(400, "All fields are required")
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname: fullname,
                email: email
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        user,
        "user details updated successfully"
    ))
})

// const updateUserAvatar = asyncHandler(async(req, res) => {
//     const avatarLocalPath = req.file?.path

//     if(!avatarLocalPath){
//         throw new ApiError(400, "Avatar file is missing ")
//     }

//     const avatar = await uploadOnCloudinary(avatarLocalPath)

//     if(!avatar){
//         throw new ApiError(500, "Error while uploading Avatar")
//     }

//     const user = await User.findByIdAndUpdate(
//         req.user?._id,
//         {
//             $set: {
//                 avatar: avatar?.url
//             }
//         },
//         {new: true}
//     ).select("-password")

//     return res
//     .status(200)
//     .json(new ApiResponse(
//         200,
//         user,
//         "Avatar updated successfully"
//     ))
// })

// const updateUserCoverImage = asyncHandler(async(req, res) => {
//     const coverImageLocalPath = req.file?.path

//     if(!coverImageLocalPath){
//         throw new ApiError(400, "Avatar file is missing ")
//     }

//     const coverImage = await uploadOnCloudinary(coverImageLocalPath)

//     if(!coverImage){
//         throw new ApiError(500, "Error while uploading Avatar")
//     }

//     const user = await User.findByIdAndUpdate(
//         req.user?._id,
//         {
//             $set: {
//                 coverImage: coverImage?.url
//             }
//         },
//         {new: true}
//     ).select("-password")

//     return res
//     .status(200)
//     .json(new ApiResponse(
//         200,
//         user,
//         "cover image updated successfully"
//     ))
// })

const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
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
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                // avatar: 1,
                // coverImage: 1,
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
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})


const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
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
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",

                            pipeline: [ // i have to try this pipeline outside of this lookup
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },

                    {
                        $addFields: { // yha tk humko owner field me ek arr milega jiske 1st element me object hoga, usko nikal ke humko owner ke field me reassign krna hai 
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
    .json(new ApiResponse(
        200,
        user[0].watchHistory,
        "watchHistory fatched successfully"
    ))
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    // updateUserAvatar,
    // updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}

import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { Video } from "../models/video.model.js"
import { Comment } from "../models/comment.model.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    //TODO: toggle like on video

    if(videoId.trim() === ""){
        throw new ApiError(400, "videoId missing")
    }

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "invalid videoId")
    }

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404, "Video not found")
    }

    const result = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },

        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },

        {
            $addFields: {
                isLiked: {
                    $cond: {
                        if: {$in: [req.user?._id, "$likes.likedBy"]},
                        then: true,
                        else: false
                    }
                }
            }
        },

        {
            $project: {
                isLiked:1
            }
        }
    ])

    if(result.length > 0 && result[0].isLiked){
        const responce = await Like.deleteOne({
            video: videoId,
            likedBy: req.user?._id
        })

        if(!responce){
            throw new ApiError(500, "something went wrong while removing like")
        }

        result[0].isLiked = false

    }else{ 

        const responce = await Like.create({
            video: videoId,
            likedBy: req.user?._id
        })

        if(!responce){
            throw new ApiError(500, "something went wrong while adding like")
        }

        result[0].isLiked = true
    }

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        result,
        "video liked successfully"
    ))
    
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    //TODO: toggle like on comment
    if(commentId.trim() === ""){
        throw new ApiError(400, "commentId missing")
    }

    if(!isValidObjectId(commentId)){
        throw new ApiError(400, "invalid commentId")
    }

    const comment = await Comment.findById(commentId)

    if(!comment){
        throw new ApiError(404, "comment not found")
    }

    const result = await Comment.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(commentId)
            }
        },

        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
                as: "likes"
            }
        },

        {
            $addFields: {
                isLiked: {
                    $cond: {
                        if: {$in: [req.user?._id, "$likes.likedBy"]},
                        then: true,
                        else: false
                    }
                }
            }
        },

        {
            $project: {
                isLiked:1
            }
        }
    ])

    if(result.length > 0 && result[0].isLiked){
        const responce = await Like.deleteOne({
            comment: commentId,
            likedBy: req.user?._id
        })

        if(!responce){
            throw new ApiError(500, "something went wrong while removing like")
        }

        result[0].isLiked = false

    }else{ 

        const responce = await Like.create({
            comment: commentId,
            likedBy: req.user?._id
        })

        if(!responce){
            throw new ApiError(500, "something went wrong while adding like")
        }

        result[0].isLiked = true
    }

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        result,
        "comment liked successfully"
    ))



})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    //TODO: toggle like on tweet
}
)

const getLikedVideos = asyncHandler(async (req, res) => {
    //TODO: get all liked videos
    
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}
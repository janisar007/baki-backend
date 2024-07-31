import mongoose, { isValidObjectId } from "mongoose"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {Video} from "../models/video.model.js"

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

    if(videoId.trim() === ""){
        throw new ApiError(400, "missing videoId")
    }

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "invalid videoId")
    }

    const video = Video.findById(videoId)

    if(!video){
        throw new ApiError(404, "video not found")
    }

    const commentAggregate = Comment.aggregate([
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId)
            }
        },

        {
            $sort:{
                createdAt: 1
            }
        },

        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerData",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
         
        {
            $project: {
                content: 1,
                createdAt:1,
                updatedAt:1,
                ownerData: {$arrayElemAt: ["$ownerData", 0]}

            }
        }
    ])

    if(!commentAggregate){
        throw new ApiError(500, "something while fetching the comment data")
    }

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const comments = await Comment.aggregatePaginate(commentAggregate, options)

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        comments,
        "comment fetched successfully"
    ))

})

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
    const {videoId} = req.params
    const {content} = req.body

    console.log(content)

    if(videoId.trim() === ""){
        throw new ApiError(400, "missing videoId")
    }

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "invalid videoId")
    }

    console.log(content)

    if(!content || content.trim() === ""){
        throw new ApiError(400, "Empty content string")
    }

    const comment = await Comment.create({
        video: videoId,
        owner: req.user?._id,
        content
    })

    if(!comment){
        throw new ApiError(500, "Something went wrong while adding comments")
    }

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        comment,
        "Comment added successfully"
    ))
})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment
    const {commentId} = req.params
    const {content} = req.body

    if(commentId.trim() === ""){
        throw new ApiError(400, "missing commentId")
    }

    if(!isValidObjectId(commentId)){
        throw new ApiError(400, "invalid commentId")
    }

    console.log(content)

    if(!content || content.trim() === ""){
        throw new ApiError(400, "Empty content string")
    }

    const comment = await Comment.findById(commentId)

    if(!comment){
        throw new ApiError(400, "comment not found")
    }

    if(req.user?._id.toString() !== comment.owner.toString()){
        throw new ApiError(400, "You are not allowed to update comment")
    }

    const updatedComment = await Comment.findByIdAndUpdate(commentId, {
        $set: {
            content: content
        }
    }, {new: true})

    if(!updatedComment){
        throw new ApiError(500, "Something went wrong while updating comment")
    }

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        updatedComment,
        "comment updated successfully"
    ))

})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
    const {commentId} = req.params

    if(commentId.trim() === ""){
        throw new ApiError(400, "commentId is missing")
    }

    if(!isValidObjectId(commentId)){
        throw new ApiError(400, "Invalid commentId")
    }

    const comment = await Comment.findById(commentId)

    if(!comment){
        throw new ApiError(404, "Comment not found")
    }

    if(req.user?._id.toString() !== comment.owner.toString()){
        throw new ApiError(400, "You are not allowed to delete this comment")
    }

    const result = await Comment.findByIdAndDelete(commentId)

    if(!result){
        throw new ApiError(500, "Something went wrong while deleting comment")
    }

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        "comment deleted successfully"
    ))
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
    deleteComment
}
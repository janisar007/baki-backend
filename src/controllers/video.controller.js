import mongoose, {isValidObjectId} from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {uploadOnCloudinary, deleteOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";
import { User } from "../models/user.model.js";
import { Comment } from "../models/comment.model.js";


const publishAVideo = asyncHandler(async(req, res) => {
    const {title, description} = req.body

    if([title, description].some((field) => !field || field.trim() === "")){
        throw new ApiError(400, "missing title or description")
    }

    let videoFilePath;
    if(req.files && Array.isArray(req.files.videoFile) && req.files.videoFile.length > 0){
        videoFilePath = req.files.videoFile[0].path
    }

    if(!videoFilePath){
        throw new ApiError(400, "Video file is missing")
    }

    let thumbnailPath;
    if(req.files && Array.isArray(req.files.thumbnail) && req.files.thumbnail.length > 0){
        thumbnailPath = req.files.thumbnail[0].path
    }

    if(!thumbnailPath){
        throw new ApiError(402, "missing thumbnail")
    }

    const videoFile = await uploadOnCloudinary(videoFilePath)
    const thumbnail = await uploadOnCloudinary(thumbnailPath)

    if(!videoFile){
        throw new ApiError(400, "video file is required")
    } 

    if(!thumbnail){
        throw new ApiError(400, "thumbnail is required")
    }

    if(!req.user){
        throw new ApiError(400, "user not logged in")
    }

    const video = await Video.create({
        videoFile : {
            url: videoFile?.url,
            public_id: videoFile.public_id
        },    
        thumbnail: {
            url: thumbnail?.url,
            public_id: thumbnail?.public_id
        },    
        title,
        description,
        duration: videoFile?.duration,
        owner: req.user?._id
    })

    const publishedVideo = await Video.findById(video._id)

    if(!publishedVideo){
        throw new ApiError(500, "something went wrong while publishing video")
    }

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        video,
        "video published successfully"
    ))


})

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType } = req.query; // Removed userId from destructuring
    const pipeline = [];

    // Full-text search using MongoDB Atlas search index
    if (query) {
        pipeline.push({
            $search: {
                index: "search-videos",
                text: {
                    query: query,
                    path: ["title", "description"] // Search only in title and description
                }
            }
        });
    }

    // Only fetch videos that are published
    pipeline.push({ $match: { isPublished: true } });

    // Sorting based on sortBy and sortType
    if (sortBy && sortType) {
        pipeline.push({
            $sort: {
                [sortBy]: sortType === "asc" ? 1 : -1
            }
        });
    } else {
        pipeline.push({ $sort: { createdAt: -1 } });
    }

    // Lookup to fetch owner details
    pipeline.push(
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$ownerDetails"
        }
    );

    // Pagination
    const videoAggregate = Video.aggregate(pipeline);
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const video = await Video.aggregatePaginate(videoAggregate, options);

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Videos fetched successfully"));
});


const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    console.log("request is made")
    console.log(videoId)
    //TODO: get video by id

    if(videoId.trim() === ""){
        throw new ApiError(400, "missing video id")
    }

    if(!isValidObjectId(videoId)){
        throw new ApiError(404, "invalid videoId")
    }

    const temp = await Video.findById(videoId)

    if(!temp){
        throw new ApiError(404, "video not found")
    }

    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        // pipeline for fetching likes on that video
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes" 
            }
        },
        // pipeline for fetching comment on that video

        {
            $lookup: {
                from: "comments",
                localField: "_id",
                foreignField: "video",
                as: "comments",

                // pipeline: [
                //     {
                //         $lookup: {
                //             from: "users",
                //             localField: "owner",
                //             foreignField: "_id",
                //             as: "owner",
                //             pipeline: [
                //                 {
                //                     $project: {
                //                         username:1
                //                     }
                //                 }
                //             ]
                //         }
                //     },

                //     {
                //         $addFields: {
                //             owner: {
                //                 $first: "$owner"
                //             }
                //         }
                //     },
                //     {
                //         $project: {
                //             content:1,
                //             owner: 1,
                //             createdAt: 1,
                //             updatedAt: 1
                //         }
                //     }
                // ]
            }
        },
        // pipeline for fetching owner detail of that video
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                // pipeline for getting subscribers data of owner
                pipeline: [
                    {
                        $lookup: { // number of subscriber of owner
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribers"
                        }
                    },

                    {
                        $addFields: { // pipeline for adding subs count and isSubscribed field to owner
                            subscribersCount: {
                                $size: "$subscribers"
                            },

                            isSubscribed : { // checking wather user(you) are belonging to subscribers list or not 
                                $cond: {
                                    if: {$in: [req.user._id, "$subscribers.subscriber"]},
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
                            avatar: 1,
                            subscribersCount: 1,
                            isSubscribed: 1
                        }
                    }

                ]
            }
        },
        // pipeline for adding fields in video
        {
            $addFields: {
                likecount: {
                    $size: "$likes"
                },
                isLiked: {
                    $cond: {
                        if: {$in: [req.user._id, "$likes.likedBy"]},
                        then: true,
                        else: false
                    }
                },
                owner: {
                    $first: "$owner"
                },

                commentsCount: {
                    $size: "$comments"
                }
            }
        },

        {
            $project: {
                "videoFile.url": 1,
                "thumbnail.url": 1,
                title: 1,
                description: 1,
                duration: 1,
                views: 1,
                isPublished:1,
                likecount: 1,
                commentsCount: 1,
                owner: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }


    ]);

    if(!video){
        throw new ApiError(500, "failed to fetch video")
    }

    // increment views if video fatched successfully

    await Video.findByIdAndUpdate(videoId, {
        $inc: {
            views: 1
        }
    });

    // adding video to user watch history if video fetched successfully

    await User.findByIdAndUpdate(req.user?._id, {
        $addToSet: {
            watchHistory: videoId
        }
    })

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        video,
        "video fetched successfully"
    ))
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const {title, description} = req.body

    //TODO: update video details like title, description, thumbnail
    if(videoId.trim() === ""){
        throw new ApiError(400, "missing video id")
    }

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, " invalid videoId" )
    }

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404, "No video found")
    }

    if(req.user?._id.toString() !== video?.owner.toString()){
        throw new ApiError(400, "You have not permisson to edit the content")
    }

    const updatedVideo =  await Video.findByIdAndUpdate(videoId, {
        $set: {
            title: title,
            description: description
        }
    },{new : true})

    if(!updatedVideo){
        throw new ApiError(500, "Failed to update video details")
    }

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        updateVideo,
        "video details Updated successfully"
    ))
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    
    if(videoId.trim() === ""){
        throw new ApiError(400, "missing video id")
    }

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "invalid videoId")
    }

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404, "video not found")
    }

    if(req.user?._id.toString() !== video.owner?.toString()){
        throw new ApiError(400, "User is not allowed to delete this video")
    }

    const deletedVideo = await Video.findByIdAndDelete(videoId)

    if(!deletedVideo){
        throw new ApiError(500, "failde to delete the video please try again")
    }

    await deleteOnCloudinary(deletedVideo.videoFile.public_id, "video")
    await deleteOnCloudinary(deletedVideo.thumbnail.public_id, "image")

    await Like.deleteMany({video: videoId})
    await Comment.deleteMany({video: videoId})
    
    return res
    .status(200)
    .json(new ApiResponse(200, "Video deleted successfully"))

})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    
    if(videoId.trim() === ""){
        throw new ApiError(400, "missing video id")
    }

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "invalid videoId")
    }

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404, "video not found")
    }

    if(req.user?._id.toString() !== video.owner.toString()){
        throw new ApiError(400, "You are not allowed to change publish status")
    }

    const flag  = video?.isPublished

    const result = await Video.findByIdAndUpdate(video?._id, {
        $set: {
            isPublished: !flag
        }
    },{new :true})


    return res
    .status(200)
    .json(new ApiResponse(
        200, 
        result,
        "publish status toggled successfully"
    ))



})


export {
    publishAVideo,
    getAllVideos,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}
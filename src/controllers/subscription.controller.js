import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    // TODO: toggle subscription

    if(channelId.trim() === ""){
        throw new ApiError(400, "missing channel Id")
    }

    if(!isValidObjectId(channelId)){
        throw new ApiError(400, "Invalid channel Id")
    }

    const user = await User.findById(channelId)

    if(!user) {
        throw new ApiError(404, "User not found")
    }

    const channel = await User.aggregate([
        {
            $match: {
                _id : new mongoose.Types.ObjectId(channelId)
            }
        },

        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as : "subscribers"
            }
        },

        {
            $addFields: {
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
                username: 1,
                isSubscribed:1,
            }
        }
    ])

    if(channel.length > 0 && channel[0].isSubscribed){
        const result  = await Subscription.deleteOne({
            subscriber : req.user?._id,
            channel : channelId
        })

        if(!result){
            throw new ApiError(500, "something went wrong while unsubscribing")
        }

        channel[0].isSubscribed =  false

    } else {

        console.log("pointer is in false block")

        const result = await Subscription.create({
            subscriber: req.user?._id,
            channel: channelId
        })

        if(!result){
            throw new ApiError(500, "Something went wrong while subscribing channel")
        }

        channel[0].isSubscribed = true
    }

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        channel,
        "Subscribe status changed successfully"
    ))
})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}
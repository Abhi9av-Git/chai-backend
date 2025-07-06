import mongoose from 'mongoose'

const subscriptionSchema=new mongoose.Schema(
  {
    subscriber: {
      type: mongoose.Schema.Types.ObjectId, // one who is Subscribing
      ref: "User"
    },
    channel: {
      type: mongoose.Schema.Types.ObjectId, // One to whom the subscription is made
      ref: "User"
    }
  }, 
  {timestamps: true}
)

export const Subscription=mongoose.model('Subscription', subscriptionSchema)
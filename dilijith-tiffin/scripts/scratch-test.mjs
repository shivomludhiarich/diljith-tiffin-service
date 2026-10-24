import mongoose from 'mongoose';

const schema = new mongoose.Schema({ subCode: String, allocatedMeals: Number, consumedMeals: Number, approvedAdjustments: Number });
const Model = mongoose.model('TestSub', schema);
const id = 'SUB-1001';
const query = {
  $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { subCode: id }],
};
console.log('Query filter:', Model.find(query).getFilter());

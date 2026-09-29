import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 5000 },
  address: { type: String, required: true, trim: true, minlength: 3, maxlength: 300 },
  regularPrice: { type: Number, required: true, min: 0, max: 1000000000 },
  discountPrice: { type: Number, required: true, min: 0, max: 1000000000 },
  bathrooms: { type: Number, required: true, min: 1, max: 100 },
  bedrooms: { type: Number, required: true, min: 1, max: 100 },
  furnished: { type: Boolean, required: true },
  parking: { type: Boolean, required: true },
  type: { type: String, enum: ['sale', 'rent'], required: true },
  offer: { type: Boolean, required: true },
  imageUrls: { type: [String], required: true, validate: { validator: (urls) => urls.length >= 1 && urls.length <= 6, message: 'A listing must contain between 1 and 6 images.' } },
  userRef: { type: String, required: true, index: true },
}, { timestamps: true, strict: true });

listingSchema.pre('validate', function (next) {
  if (this.discountPrice > this.regularPrice) return next(new Error('Discount price must not exceed regular price.'));
  return next();
});

listingSchema.index({ type: 1, offer: 1, furnished: 1, parking: 1, createdAt: -1 });
listingSchema.index({ name: 1 });
listingSchema.index({ name: 'text' });

export default mongoose.model('Listing', listingSchema);
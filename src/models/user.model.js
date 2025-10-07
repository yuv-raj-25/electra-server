import {Schema , model} from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";


const userSchema = new Schema({
    userName:{
        type:String,
        required:true,
        unique:true,
        trim:true,
        lowercase:true,
        index:true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        validate:{
            validator: function (email) {
                // Simple email format validation
                return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email);
              },
              message: props => `${props.value} is not a valid email!`
        }
    },
    password: {
        type: String,
        required: [true , "password is required "],
        validate: {
            validator: function (password){
                return strongPasswordRegex.test(password)
            },
            message: props => 
            `Password must be at least 8 characters long, and include at least one uppercase letter, one lowercase letter, one number, and one special character.`
        }
        
    },
    phoneNumber: {
    type: String,
    unique: true,
    sparse: true,
    validate: {
      validator: (v) => /^[6-9]\d{9}$/.test(v),
      message: "Invalid Indian phone number",
    },
  },
    profileImage:{
        type: String, // cloudinary url
        required: [true  , "profile image is required"],
    },

    vehicles: [{
    make: {
      type: String,
      required: [true, 'Vehicle make is required'],
      trim: true,
      // e.g., Tesla, BMW, Audi, Nissan, Chevrolet, Hyundai
    },
    
    model: {
      type: String,
      required: [true, 'Vehicle model is required'],
      trim: true,
      // e.g., Model 3, Model S, i4, e-tron, Leaf, Bolt EV, Kona Electric
    },
    
    year: {
      type: Number,
      required: [true, 'Vehicle year is required'],
      min: [2010, 'Year must be 2010 or later'],
      max: [new Date().getFullYear() + 1, 'Year cannot be in the future']
    },
    
    vehicleType: {
      type: String,
      // required: [true, 'Vehicle type is required'],
      enum: {
        values: ['sedan', 'suv', 'hatchback', 'coupe', 'truck', 'van', 'convertible', 'wagon'],
        message: '{VALUE} is not a valid vehicle type'
      }
      // sedan, suv, hatchback, coupe, truck, van, convertible, wagon
    }, 
    licensePlate: {
      type: String,
      required: [true, 'License plate is required'],
      unique: true,
      uppercase: true,
      trim: true,
      validate: {
        validator: function(value) {
          // Basic validation - alphanumeric with optional hyphens/spaces
          return /^[A-Z0-9\s-]+$/.test(value);
        },
        message: 'License plate must contain only letters, numbers, spaces, and hyphens'
      }
    },
    
    batteryCapacity: {
      type: Number,
      // in kWh, e.g., 75, 82, 100
      min: [10, 'Battery capacity must be at least 10 kWh']
    },
    
    range: {
      type: Number,
      // in kilometers or miles
      min: [0, 'Range cannot be negative']
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
   refreshToken:{
        type: String
    },
} , {timestamps:true})



userSchema.pre("save" , async function(next){
    if(!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password , 10);
    next();
})

userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password , this.password);
}


userSchema.methods.generateAccessToken = function(){

    jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}


export const User = model("User" , userSchema);


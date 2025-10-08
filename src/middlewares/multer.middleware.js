import multer from "multer";


const storage = multer.diskStorage({
    destination: function(req , file , cb){
        cb(null , "./public/temp")
    },
    filename: function(req , file , cb){
        cb(null , file.originalname)
    }
})

// File filter (optional but recommended). 
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only images are allowed"), false);
  }
};

// Multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5 MB
});
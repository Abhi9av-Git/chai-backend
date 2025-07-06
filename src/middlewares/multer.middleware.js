import multer from 'multer';

const storage=multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/temp") // specify the directory where your file will be stored
  },
  filename: function(req, file, cb) {
    cb(null, file.originalname)
  }
})

export const upload=multer({
    storage,
    fileFilter: (req, file, cb) => {
      // Check file type
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed!'), false);
      }
    },
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    }
})

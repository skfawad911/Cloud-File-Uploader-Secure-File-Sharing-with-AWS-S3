const express = require("express");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const config = require("./config");

const app = express();
const upload = multer({ dest: "uploads/" });

const s3 = new S3Client({
  region: config.awsRegion,
  credentials: {
    accessKeyId: config.awsAccessKeyId,
    secretAccessKey: config.awsSecretAccessKey,
  },
});

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.use(express.static(path.join(__dirname, "public")));

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const fileContent = fs.readFileSync(req.file.path);
  const params = {
    Bucket: config.awsBucketName,
    Key: req.file.originalname,
    Body: fileContent,
  };

  const uploadCommand = new PutObjectCommand(params);

  try {
    await s3.send(uploadCommand);

    const signedUrlParams = {
      Bucket: config.awsBucketName,
      Key: req.file.originalname,
      Expires: 86400,
    };

    const url = await getSignedUrl(s3, new GetObjectCommand(signedUrlParams), {
      expiresIn: 86400,
    });

    res.send(url);
  } catch (err) {
    console.error("Error uploading file:", err);
    res.status(500).send("Error uploading file.");
  } finally {
    // Clean up the uploaded file from local directory
    fs.unlink(req.file.path, (unlinkErr) => {
      if (unlinkErr) {
        console.error("Error deleting file:", unlinkErr);
      } else {
        console.log("File deleted from local directory.");
      }
    });
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

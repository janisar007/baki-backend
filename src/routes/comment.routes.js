import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { addComment, deleteComment, getVideoComments, updateComment } from "../controllers/comment.controller.js";

const router = Router();

router.use(verifyJWT)

router.route("/addComment/:videoId").post(addComment)
router.route("/:videoId").get(getVideoComments)
router.route("/delete/:commentId").delete(deleteComment)
router.route("/update/:commentId").patch(updateComment)

export default router
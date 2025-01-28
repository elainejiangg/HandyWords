"use client";

import { useEffect, useRef, useState } from "react";

export default function PosePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Add state for all landmark types
  const [handLandmarks, setHandLandmarks] = useState<any[]>([]);
  const [poseLandmarks, setPoseLandmarks] = useState<any[]>([]);
  const [faceLandmarks, setFaceLandmarks] = useState<any[]>([]);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    const canvasCtx = canvasElement.getContext("2d");

    async function initializeTracking() {
      // Dynamically import MediaPipe modules
      const { Hands, HAND_CONNECTIONS } = await import("@mediapipe/hands");
      const { Pose, POSE_CONNECTIONS } = await import("@mediapipe/pose");
      const { FaceMesh, FACEMESH_TESSELATION } = await import(
        "@mediapipe/face_mesh"
      );
      const { Camera } = await import("@mediapipe/camera_utils");
      const { drawConnectors, drawLandmarks } = await import(
        "@mediapipe/drawing_utils"
      );

      // Initialize MediaPipe components
      const hands = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      const pose = new Pose({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });

      const faceMesh = new FaceMesh({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });

      // Configure settings
      hands.setOptions({
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      // Define landmark indices from MutEmotion model
      const filteredPose = [11, 12, 13, 14, 15, 16];
      const filteredFace = [
        0, 4, 7, 8, 10, 13, 14, 17, 21, 33, 37, 39, 40, 46, 52, 53, 54, 55, 58,
        61, 63, 65, 66, 67, 70, 78, 80, 81, 82, 84, 87, 88, 91, 93, 95, 103,
        105, 107, 109, 127, 132, 133, 136, 144, 145, 146, 148, 149, 150, 152,
        153, 154, 155, 157, 158, 159, 160, 161, 162, 163, 172, 173, 176, 178,
        181, 185, 191, 234, 246, 249, 251, 263, 267, 269, 270, 276, 282, 283,
        284, 285, 288, 291, 293, 295, 296, 297, 300, 308, 310, 311, 312, 314,
        317, 318, 321, 323, 324, 332, 334, 336, 338, 356, 361, 362, 365, 373,
        374, 375, 377, 378, 379, 380, 381, 382, 384, 385, 386, 387, 388, 389,
        390, 397, 398, 400, 402, 405, 409, 415, 454, 466, 468, 473,
      ];

      // Set up separate results handling for each model
      const onHandResults = (results: any) => {
        if (!canvasCtx) return;

        canvasCtx.save();
        if (results.multiHandLandmarks) {
          for (const landmarks of results.multiHandLandmarks) {
            setHandLandmarks(results.multiHandLandmarks);
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
              color: "#00FF00",
              lineWidth: 2,
            });
            drawLandmarks(canvasCtx, landmarks, {
              color: "#FF0000",
              lineWidth: 1,
              radius: 3,
            });
          }
        }
        canvasCtx.restore();
      };

      const onPoseResults = (results: any) => {
        if (!canvasCtx) return;

        canvasCtx.save();
        if (results.poseLandmarks) {
          const filteredLandmarks = filteredPose.map(
            (i) => results.poseLandmarks[i]
          );
          setPoseLandmarks(filteredLandmarks);

          // Define connections for upper body only
          const upperBodyConnections = [
            [11, 13],
            [13, 15], // left arm
            [12, 14],
            [14, 16], // right arm
            [11, 12], // shoulders
          ];
          // Draw only the connections we want
          for (const [start, end] of upperBodyConnections) {
            drawConnectors(
              canvasCtx,
              [results.poseLandmarks[start], results.poseLandmarks[end]],
              [[0, 1]], // connect first point to second point
              {
                color: "#0000FF",
                lineWidth: 2,
              }
            );
          }

          drawLandmarks(canvasCtx, filteredLandmarks, {
            color: "#0000FF",
            lineWidth: 1,
            radius: 3,
          });
        }
        canvasCtx.restore();
      };

      const onFaceResults = (results: any) => {
        if (!canvasCtx) return;

        canvasCtx.save();
        if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
          const currentFaceLandmarks = results.multiFaceLandmarks[0];
          const filteredLandmarks = filteredFace.map(
            (i) => currentFaceLandmarks[i]
          );
          setFaceLandmarks(filteredLandmarks);
          drawLandmarks(canvasCtx, filteredLandmarks, {
            color: "#FF00FF",
            lineWidth: 1,
            radius: 2,
          });
        }
        canvasCtx.restore();
      };

      // Set up processing pipeline with separate callbacks
      hands.onResults(onHandResults);
      pose.onResults(onPoseResults);
      faceMesh.onResults(onFaceResults);

      // Add a function to clear and prepare canvas before each frame
      const prepareCanvas = (image: HTMLVideoElement) => {
        if (!canvasCtx) return;
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.drawImage(
          image,
          0,
          0,
          canvasElement.width,
          canvasElement.height
        );
      };

      // Start camera
      const camera = new Camera(videoElement, {
        onFrame: async () => {
          prepareCanvas(videoElement); // Clear and prepare canvas once per frame
          await hands.send({ image: videoElement });
          await pose.send({ image: videoElement });
          await faceMesh.send({ image: videoElement });
        },
        width: 640,
        height: 480,
      });
      camera.start();

      return { hands, pose, faceMesh, camera };
    }

    let cleanup: { hands: any; pose: any; faceMesh: any; camera: any } | null =
      null;
    initializeTracking().then((instances) => {
      cleanup = instances;
    });

    return () => {
      if (cleanup) {
        cleanup.hands.close();
        cleanup.pose.close();
        cleanup.faceMesh.close();
        cleanup.camera.stop();
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">Pose Estimation</h1>
      <video
        ref={videoRef}
        style={{ display: "none" }}
        width="640"
        height="480"
        autoPlay
      />
      <canvas
        ref={canvasRef}
        width="640"
        height="480"
        className="border rounded"
      />
    </div>
  );
}

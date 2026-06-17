import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.tsx";
import styles from "./UploadPage.module.css";

type UploadState = "idle" | "uploading" | "success" | "error";

interface InterpretationResult {
  meme_identified_as: string;
  interpretation: string;
  proposed_action: string;
  confidence_level: string;
}

interface UploadResult {
  submission_id: string;
  sequence_number: number;
  stored_filename: string;
  sha256_hash: string;
  interpretation: InterpretationResult | null;
}

export default function UploadPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<UploadState>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed (PNG, JPG, GIF, WebP)");
      return;
    }
    setError("");
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
    setState("idle");
    setResult(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !session?.teamId || !session?.projectId) return;

    setState("uploading");
    setError("");

    const formData = new FormData();
    formData.append("meme", selectedFile);
    formData.append("team_id", session.teamId);
    formData.append("project_id", session.projectId);

    try {
      const res = await fetch("/api/meme", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as UploadResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Upload failed");
      }
      setResult(data);
      setState("success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      setState("error");
    }
  };

  const handleReset = () => {
    setState("idle");
    setPreview(null);
    setSelectedFile(null);
    setResult(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const confidenceColor = (level?: string) => {
    if (level === "high") return "var(--success)";
    if (level === "medium") return "var(--warning)";
    return "var(--error)";
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Submit a Meme</h1>
        <p className={styles.subtitle}>
          Drop your meme. Claude will interpret it and decide what to build
          next. <strong>No text. Only memes.</strong>
        </p>
      </div>

      {state !== "success" && (
        <div
          className={`${styles.dropzone} ${dragOver ? styles.dragOver : ""} ${preview ? styles.hasFile : ""}`}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => !preview && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            className={styles.hiddenInput}
          />

          {!preview && (
            <div className={styles.placeholder}>
              <div className={styles.placeholderIcon}>🖼️</div>
              <p className={styles.placeholderText}>
                Drag &amp; drop your meme here
              </p>
              <p className={styles.placeholderSub}>or click to browse</p>
              <p className={styles.placeholderNote}>
                PNG, JPG, GIF, WebP — max 10MB
              </p>
            </div>
          )}

          {preview && (
            <img
              src={preview}
              alt="Selected meme"
              className={styles.previewImage}
            />
          )}
        </div>
      )}

      {error && <div className={styles.errorBox}>{error}</div>}

      {preview && state !== "success" && (
        <div className={styles.actions}>
          <button onClick={handleReset} className={styles.resetBtn}>
            Choose different meme
          </button>
          <button
            onClick={handleUpload}
            className={styles.submitBtn}
            disabled={state === "uploading"}
          >
            {state === "uploading" ? (
              <span className={styles.loading}>Interpreting meme</span>
            ) : (
              "Submit Meme →"
            )}
          </button>
        </div>
      )}

      {state === "success" && result && (
        <div className={styles.resultCard}>
          <div className={styles.resultHeader}>
            <span className={styles.checkmark}>✓</span>
            <div>
              <div className={styles.resultTitle}>
                Meme submitted &amp; interpreted
              </div>
              <div className={styles.resultMeta}>
                #{result.sequence_number} · SHA-256:{" "}
                <code className={styles.hash}>
                  {result.sha256_hash.slice(0, 16)}...
                </code>
              </div>
            </div>
            <img
              src={`/uploads/${result.stored_filename}`}
              alt="Submitted meme"
              className={styles.resultThumb}
            />
          </div>

          {result.interpretation ? (
            <div className={styles.interpretation}>
              <div className={styles.memeName}>
                {result.interpretation.meme_identified_as}
                <span
                  className={styles.confidence}
                  style={{
                    color: confidenceColor(
                      result.interpretation.confidence_level
                    ),
                  }}
                >
                  {result.interpretation.confidence_level} confidence
                </span>
              </div>
              <p className={styles.interpretText}>
                {result.interpretation.interpretation}
              </p>
              <div className={styles.actionBox}>
                <span className={styles.actionLabel}>→ Proposed action</span>
                <p className={styles.actionText}>
                  {result.interpretation.proposed_action}
                </p>
              </div>
            </div>
          ) : (
            <div className={styles.noInterpret}>
              Interpretation pending — admin will review.
            </div>
          )}

          <div className={styles.resultActions}>
            <button onClick={handleReset} className={styles.submitBtn}>
              Submit another meme
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className={styles.resetBtn}
            >
              Back to dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

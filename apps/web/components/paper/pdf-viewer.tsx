"use client";

import { FileWarning, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";

/** Shows the private PDF through the browser's built-in viewer. `page` jumps to a page (citations). */
export function PdfViewer({ paperId, page }: { paperId: string; page?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;
    api
      .pdfBlobUrl(paperId)
      .then((u) => {
        if (revoked) return URL.revokeObjectURL(u);
        objectUrl = u;
        setUrl(u);
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [paperId]);

  if (error)
    return (
      <div className="text-muted-foreground grid h-full place-items-center p-8 text-center text-sm">
        <div>
          <FileWarning className="mx-auto mb-2 size-8" /> {error}
        </div>
      </div>
    );
  if (!url)
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="text-primary size-6 animate-spin" />
      </div>
    );
  // Changing the hash alone re-navigates the embedded viewer without reloading the file.
  return <iframe title="Paper PDF" src={`${url}#page=${page ?? 1}&toolbar=1`} className="h-full w-full rounded-xl bg-white" />;
}

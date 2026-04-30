import { useEffect, useRef, useState } from "react"

import { api, API_BASE_URL } from "@/lib/api"

function isObjectUrl(src: string) {
  return src.startsWith("blob:") || src.startsWith("data:")
}

function isHttpUrl(src: string) {
  return /^https?:\/\//i.test(src)
}

function isMediaAsset(src: string) {
  try {
    const url = new URL(src, API_BASE_URL)
    return url.pathname.startsWith("/media/")
  } catch {
    return src.startsWith("/media/")
  }
}

function canRenderDirectly(src: string) {
  return isObjectUrl(src) || isHttpUrl(src) || isMediaAsset(src) || !isApiHostedUrl(src)
}

function isApiHostedUrl(src: string) {
  try {
    return new URL(src, API_BASE_URL).origin === new URL(API_BASE_URL).origin
  } catch {
    return false
  }
}

export function useResolvedImageSrc(src: string | null) {
  return useResolvedImageSrcWithFallback(src, null)
}

export function useResolvedImageSrcWithFallback(src: string | null, fallbackSrc: string | null) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(() => {
    if (src && canRenderDirectly(src)) return src
    if (fallbackSrc && canRenderDirectly(fallbackSrc)) return fallbackSrc
    return null
  })
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }

    if (!src) {
      setResolvedSrc(fallbackSrc && canRenderDirectly(fallbackSrc) ? fallbackSrc : null)
      return
    }

    if (canRenderDirectly(src)) {
      setResolvedSrc(src)
      return
    }

    const nextSrc = src
    setResolvedSrc(null)

    async function loadImage() {
      try {
        const response = await api.get(nextSrc, {
          responseType: "blob",
        })

        if (cancelled) return

        const imageBlob = response.data as Blob
        if (!imageBlob.type.startsWith("image/")) {
          console.warn("Avatar response is not an image blob", {
            src: nextSrc,
            type: imageBlob.type || "unknown",
            size: imageBlob.size,
          })
          setResolvedSrc(null)
          return
        }

        const nextObjectUrl = URL.createObjectURL(imageBlob)
        objectUrlRef.current = nextObjectUrl
        setResolvedSrc(nextObjectUrl)
      } catch {
        if (!cancelled) {

          setResolvedSrc(fallbackSrc && canRenderDirectly(fallbackSrc) ? fallbackSrc : null)

        }
      }
    }

    void loadImage()

    return () => {
      cancelled = true
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [fallbackSrc, src])

  return resolvedSrc
}

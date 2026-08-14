import { supabase } from './supabase'

const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || ''
const R2_ACCOUNT_ID = import.meta.env.VITE_R2_ACCOUNT_ID || ''

async function compressImage(file: File, maxDim = 1280, quality = 0.8): Promise<File> {
  const isResizable =
    file.type.startsWith('image/') &&
    file.type !== 'image/svg+xml' &&
    file.type !== 'image/gif'
  if (!isResizable) return file

  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = dataUrl
    })

    let { width, height } = img
    if (width > maxDim || height > maxDim) {
      if (width >= height) {
        height = Math.round((height / width) * maxDim)
        width = maxDim
      } else {
        width = Math.round((width / height) * maxDim)
        height = maxDim
      }
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, width, height)

    const useWebp = canvas.toDataURL('image/webp').startsWith('data:image/webp')
    const mimeType = useWebp ? 'image/webp' : 'image/jpeg'

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mimeType, quality)
    )

    if (!blob || blob.size >= file.size) return file

    const ext = useWebp ? 'webp' : 'jpg'
    const baseName = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${baseName}.${ext}`, { type: mimeType })
  } catch {
    return file
  }
}

export async function uploadToR2(
  file: File,
  venueId: string,
  folder: 'products' | 'logos' | 'venue' = 'products'
): Promise<{ url: string; key: string }> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('You must be logged in to upload files.')

  const uploadFile = await compressImage(file)

  const { data, error } = await supabase.functions.invoke('generate-upload-url', {
    body: {
      fileName: uploadFile.name,
      fileType: uploadFile.type,
      fileSize: uploadFile.size,
      venueId,
      folder,
    },
  })

  if (error) {
    try {
      const errBody = await error.context?.json?.()
      throw new Error(errBody?.error || error.message)
    } catch {
      throw new Error(error.message)
    }
  }
  if (data?.error) throw new Error(data.error)

  const { presignedUrl, publicUrl, objectKey } = data

  try {
    const res = await fetch(presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': uploadFile.type },
      body: uploadFile,
    })

    if (!res.ok) {
      throw new Error(`R2 upload failed: ${res.status} ${res.statusText}`)
    }
  } catch (err: unknown) {
    if (err instanceof Error && (!err.message || err.message === 'Failed to fetch' || err.name === 'TypeError')) {
      // eslint-disable-next-line preserve-caught-error
      throw new Error('Failed to upload image. Please check your connection and try again.')
    }
    throw err
  }

  return { url: publicUrl, key: objectKey }
}

export async function deleteFromR2(keyOrUrl: string, venueId: string): Promise<boolean> {
  if (!keyOrUrl) return false

  let objectKey = keyOrUrl
  if (keyOrUrl.startsWith('http') && R2_PUBLIC_URL) {
    objectKey = keyOrUrl.replace(`${R2_PUBLIC_URL}/`, '')
  }

  try {
    const { error } = await supabase.functions.invoke('delete-r2-object', {
      body: { objectKey, venueId },
    })

    if (error) {
      console.error('[R2] delete-r2-object error:', error.message)
      return false
    }

    return true
  } catch (err) {
    console.error('[R2] deleteFromR2 unexpected error:', err)
    return false
  }
}

export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_PUBLIC_URL)
}

export function getR2Url(key: string): string | null {
  if (!key) return null
  if (key.startsWith('http')) return key
  return `${R2_PUBLIC_URL}/${key}`
}
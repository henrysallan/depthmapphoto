import { useCallback, useState } from 'react'

export function useDropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [isOver, setIsOver] = useState(false)

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsOver(false)
  const files = Array.from(e.dataTransfer.files) as File[]
  const accepted: File[] = files.filter((f) => /image\/(jpeg|png|webp)/i.test(f.type))
    if (accepted.length) onFiles(accepted)
  }, [onFiles])

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsOver(true)
  }, [])

  const onDragLeave = useCallback(() => setIsOver(false), [])

  const dropProps = {
    onDragOver,
    onDragLeave,
    onDrop,
  }

  return { isOver, dropProps }
}

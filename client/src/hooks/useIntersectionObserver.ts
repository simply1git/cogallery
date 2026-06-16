import { useEffect, useState, useRef, RefObject } from 'react'

interface Args {
  rootMargin?: string
  threshold?: number | number[]
  triggerOnce?: boolean
}

export function useIntersectionObserver<T extends Element>({
  rootMargin = '0px',
  threshold = 0,
  triggerOnce = false,
}: Args = {}): [RefObject<T>, boolean] {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isIntersecting = entry.isIntersecting
        setInView(isIntersecting)

        if (isIntersecting && triggerOnce) {
          observer.unobserve(element)
        }
      },
      { rootMargin, threshold }
    )

    observer.observe(element)

    return () => {
      observer.unobserve(element)
    }
  }, [rootMargin, threshold, triggerOnce])

  return [ref, inView]
}

import { useEffect, useRef, useState } from 'react'

export function useSettingsNavigation(sectionIds) {
  const rootRef = useRef(null)
  const asideRef = useRef(null)
  const navRef = useRef(null)
  const lock = useRef(null)
  const [active, setActive] = useState('store-info')
  const key = sectionIds.join(',')
  const scroller = () => {
    for (let node = rootRef.current?.parentElement; node; node = node.parentElement) {
      if (['auto', 'scroll'].includes(getComputedStyle(node).overflowY)) return node
    }
    return document.scrollingElement
  }
  const offset = () => window.matchMedia('(min-width: 1280px)').matches ? 24 : (asideRef.current?.offsetHeight || 0) + 16
  useEffect(() => {
    const container = scroller()
    if (!container) return
    const ids = key.split(',')
    const update = () => {
      if (lock.current) return
      const top = container.getBoundingClientRect().top + offset() + 8
      let current = ids[0]
      for (const id of ids) {
        const node = rootRef.current?.querySelector(`#${id}`)
        if (node && node.getBoundingClientRect().top <= top) current = id
      }
      if (container.scrollTop > 0 && container.scrollTop + container.clientHeight >= container.scrollHeight - 2) current = ids.at(-1)
      setActive(current)
    }
    const unlock = () => { clearTimeout(lock.current); lock.current = null }
    container.addEventListener('scroll', update, { passive: true })
    container.addEventListener('scrollend', unlock)
    container.addEventListener('wheel', unlock, { passive: true })
    container.addEventListener('touchstart', unlock, { passive: true })
    return () => {
      unlock()
      container.removeEventListener('scroll', update)
      container.removeEventListener('scrollend', unlock)
      container.removeEventListener('wheel', unlock)
      container.removeEventListener('touchstart', unlock)
    }
  }, [key])
  useEffect(() => {
    const nav = navRef.current
    const button = nav?.querySelector(`[data-section="${active}"]`)
    if (nav && button && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: button.offsetLeft - nav.offsetLeft - (nav.clientWidth - button.offsetWidth) / 2, behavior: 'smooth' })
  }, [active])
  const navigate = (id) => {
    const node = rootRef.current?.querySelector(`#${id}`)
    const container = scroller()
    if (!node || !container) return
    setActive(id)
    clearTimeout(lock.current)
    lock.current = setTimeout(() => { lock.current = null }, 1000)
    container.scrollTo({ top: container.scrollTop + node.getBoundingClientRect().top - container.getBoundingClientRect().top - offset(), behavior: 'smooth' })
  }
  return { rootRef, asideRef, navRef, active, navigate }
}

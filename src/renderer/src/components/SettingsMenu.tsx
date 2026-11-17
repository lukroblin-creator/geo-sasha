import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../data/i18n'

export function SettingsMenu({ floating = false }: { floating?: boolean }): React.JSX.Element | null {
  const { language, setLanguage, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const closeOnOutsideClick = (event: PointerEvent): void => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  if (typeof document === 'undefined') return null

  const menu = (
    <div className={`settings-menu-root${floating ? ' is-floating' : ''}`} ref={menuRef}>
      {floating && (
        <div className="settings-menu-status" role="status">
          <span className="status-dot" aria-hidden="true" />
          <span className="status-text">{t('Application locale')}</span>
        </div>
      )}
      <button
        className={`settings-menu-trigger${open ? ' is-open' : ''}`}
        type="button"
        aria-label={t('Paramètres')}
        aria-expanded={open}
        aria-controls="global-settings-menu"
        title={t('Paramètres')}
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" fillRule="evenodd" aria-hidden="true">
          <path d="M19.14 12.94a7.8 7.8 0 0 0 .06-.94 7.8 7.8 0 0 0-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54a.49.49 0 0 0-.49-.42h-3.84a.49.49 0 0 0-.49.42L9.21 5.3a7.2 7.2 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.67 8.82a.5.5 0 0 0 .12.64l2.03 1.58a7.8 7.8 0 0 0-.06.96 7.8 7.8 0 0 0 .06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.39 1.05.7 1.63.94l.36 2.54c.03.24.24.42.49.42h3.84c.25 0 .46-.18.49-.42l.36-2.54a7.2 7.2 0 0 0 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
        </svg>
      </button>
      {open && (
        <section className="settings-menu-popover" id="global-settings-menu" aria-label={t('Paramètres')}>
          <h2>{t('Paramètres')}</h2>
          <label className="settings-language-field">
            <span>{t('Langue')}</span>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as typeof language)}
              aria-label={t('Modifier la langue du logiciel')}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </label>
        </section>
      )}
    </div>
  )

  return floating ? createPortal(menu, document.body) : menu
}

import { useEffect, useState } from 'react'
import Modal from './Modal'
import TitlesCollection from './TitlesCollection'
import { fetchTitles } from '../api/client'

function TitlesModal({ onClose }) {
  const [titles, setTitles] = useState([])
  const [state, setState] = useState('loading') // loading | success | error

  useEffect(() => {
    let ignore = false
    fetchTitles()
      .then((data) => {
        if (ignore) return
        setTitles(data)
        setState('success')
      })
      .catch(() => {
        if (!ignore) setState('error')
      })
    return () => {
      ignore = true
    }
  }, [])

  return (
    <Modal title="称号図鑑" onClose={onClose}>
      {state === 'loading' && <p className="map-view__empty">読み込み中…</p>}
      {state === 'error' && <p className="map-view__empty">称号一覧を取得できませんでした。</p>}
      {state === 'success' && <TitlesCollection titles={titles} />}
    </Modal>
  )
}

export default TitlesModal

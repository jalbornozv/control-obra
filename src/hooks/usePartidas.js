import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function usePartidas(obraId) {
  const [partidas, setPartidas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPartidas = useCallback(async () => {
    if (!obraId) return
    const { data, error } = await supabase
      .from('partidas')
      .select('*')
      .eq('obra_id', obraId)
      .order('dia_ini', { ascending: true })

    if (error) setError(error.message)
    else setPartidas(data || [])
    setLoading(false)
  }, [obraId])

  useEffect(() => {
    fetchPartidas()
    const interval = setInterval(fetchPartidas, 30000)
    return () => clearInterval(interval)
  }, [fetchPartidas])

  return { partidas, loading, error }
}

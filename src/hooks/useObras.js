import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useObras() {
  const [obras, setObras] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchObras = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('obras')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) setError(error.message)
    else setObras(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchObras() }, [fetchObras])

  return { obras, loading, error, refetch: fetchObras }
}

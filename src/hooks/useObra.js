import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useObra() {
  const [obra, setObra] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchObra() {
      const { data, error } = await supabase
        .from('obras')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) setError(error.message)
      else setObra(data)
      setLoading(false)
    }
    fetchObra()
  }, [])

  return { obra, loading, error }
}

'use client'
import { useEffect } from 'react'

export default function GDriveCallback() {
  useEffect(() => {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const token = params.get('access_token')
    if (token && window.opener) {
      window.opener.postMessage({ type: 'gdrive_token', token }, window.location.origin)
    }
  }, [])
  return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#03004F',color:'#fff',fontFamily:'Roboto,sans-serif',fontSize:14 }}>
      <div style={{ textAlign:'center',gap:12,display:'flex',flexDirection:'column',alignItems:'center' }}>
        <div style={{ width:32,height:32,border:'2px solid rgba(255,255,255,.1)',borderTopColor:'#F4B800',borderRadius:'50%',animation:'spin .75s linear infinite' }} />
        <p>Autenticando com o Google Drive...</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}

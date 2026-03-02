import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/home'
import GetLogs from './pages/GetLogs'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/getlogs" element={<GetLogs />} />
      </Routes>
    </Router>
  )
}

export default App
  
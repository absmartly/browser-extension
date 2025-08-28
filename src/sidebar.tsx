import React, { useState, useEffect } from "react"
import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"
import ExperimentList from "./components/ExperimentList"
import ExperimentDetail from "./components/ExperimentDetail"
import Login from "./components/Login"
import type { Experiment, Config } from "./types"
import "./style.css"

export default function Sidebar() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useStorage("sidebarOpen", true)
  const storage = new Storage()

  useEffect(() => {
    checkAuthentication()
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      fetchExperiments()
    }
  }, [isAuthenticated])

  const checkAuthentication = async () => {
    try {
      const config = await storage.get<Config>("config")
      if (config?.apiKey) {
        setIsAuthenticated(true)
      }
      setLoading(false)
    } catch (err) {
      setLoading(false)
      setError("Failed to check authentication")
    }
  }

  const fetchExperiments = async () => {
    try {
      setLoading(true)
      const config = await storage.get<Config>("config")
      if (!config) {
        throw new Error("No configuration found")
      }

      const response = await fetch(`${config.apiUrl}/experiments`, {
        headers: {
          "X-API-Key": config.apiKey,
          "Content-Type": "application/json"
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch experiments: ${response.statusText}`)
      }

      const data = await response.json()
      setExperiments(data.items || [])
      setLoading(false)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleLoginSuccess = () => {
    setIsAuthenticated(true)
    setError(null)
  }

  const handleLogout = async () => {
    await storage.clear()
    setIsAuthenticated(false)
    setSelectedExperiment(null)
    setExperiments([])
  }

  const handleBackToList = () => {
    setSelectedExperiment(null)
  }

  // Sidebar toggle button (always visible)
  const toggleButton = (
    <button
      className="absmartly-sidebar-toggle"
      onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      title={isSidebarOpen ? "Close ABsmartly" : "Open ABsmartly"}
    >
      {isSidebarOpen ? "×" : "AB"}
    </button>
  )

  // Main sidebar content
  const sidebarContent = (
    <div className={`absmartly-sidebar ${isSidebarOpen ? "open" : "closed"}`}>
      <div className="absmartly-sidebar-header">
        <img src="/icon.png" alt="ABsmartly" className="sidebar-logo" />
        <h1>ABsmartly</h1>
        {isAuthenticated && (
          <button onClick={handleLogout} className="logout-btn" title="Logout">
            ⎋
          </button>
        )}
      </div>

      <div className="absmartly-sidebar-content">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : !isAuthenticated ? (
          <Login onSuccess={handleLoginSuccess} />
        ) : selectedExperiment ? (
          <ExperimentDetail 
            experiment={selectedExperiment} 
            onBack={handleBackToList}
          />
        ) : (
          <ExperimentList 
            experiments={experiments}
            onSelectExperiment={setSelectedExperiment}
          />
        )}
      </div>
    </div>
  )

  return (
    <>
      {toggleButton}
      {sidebarContent}
    </>
  )
}
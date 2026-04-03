import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import ThemeInput from "./ThemeInput.jsx"
import LoadingStatus from "./LoadingStatus.jsx"
import { API_BASE_URL } from "../util.js"

// How often to poll (ms). Keep it reasonable to avoid hammering the server.
const POLL_INTERVAL_MS = 3000

function StoryGenerator() {
    const navigate = useNavigate()
    const [theme, setTheme] = useState("")
    const [jobId, setJobId] = useState(null)
    const [jobStatus, setJobStatus] = useState(null)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)


    const jobIdRef = useRef(null)

    useEffect(() => {
    jobIdRef.current = jobId
    }, [jobId])

useEffect(() => {
    const isTransient = jobStatus === "pending" || jobStatus === "processing"
    if (!isTransient) return

    const pollInterval = setInterval(() => {
        if (jobIdRef.current) pollJobStatus(jobIdRef.current)
    }, POLL_INTERVAL_MS)

    return () => clearInterval(pollInterval)

    }, [jobStatus])


const generateStory = async (selectedTheme) => {
    setLoading(true)
    setError(null)
    setTheme(selectedTheme)

    try {
        const response = await axios.post(`${API_BASE_URL}/stories/create`, {
            theme: selectedTheme,
        })
        const { job_id, status } = response.data
        setJobId(job_id)
        setJobStatus(status) // triggers the useEffect above

        // Kick off an immediate poll so we don't wait the full interval first.
        pollJobStatus(job_id)
    }   catch (e) {
        setLoading(false)
        setError(`Failed to generate story: ${e.message}`)
    }
    }

const pollJobStatus = async (id) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/jobs/${id}`)
        const { status, story_id, error: jobError } = response.data

        setJobStatus(status)

        if (status === "completed" && story_id) {
        setLoading(false)
        navigate(`/story/${story_id}`)
        } else if (status === "failed" || jobError) {
        setError(jobError || "Failed to generate story")
        setLoading(false)
        }
    } catch (e) {
        if (e.response?.status !== 404) {
        setError(`Failed to check story status: ${e.message}`)
        setLoading(false)
        }
    }
}



const reset = () => {
    setJobId(null)
    setJobStatus(null)
    setError(null)
    setTheme("")
    setLoading(false)
}



return (
    <div className="story-generator">
        {error && (
        <div className="error-message">
            <p>{error}</p>
            <button onClick={reset}>Try Again</button>
        </div>
        )}

        {!jobId && !error && !loading && <ThemeInput onSubmit={generateStory} />}

        {loading && <LoadingStatus theme={theme} />}
    </div>
    )
}

export default StoryGenerator
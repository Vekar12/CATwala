import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Instructions from './pages/Instructions'
import Test from './pages/Test'
import Results from './pages/Results'
import Review from './pages/Review'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/instructions/:testId" element={<Instructions />} />
      <Route path="/test/:testId" element={<Test />} />
      <Route path="/results/:testId" element={<Results />} />
      <Route path="/review/:testId" element={<Review />} />
    </Routes>
  )
}

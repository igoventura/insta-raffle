'use client'

import { useState } from 'react'
import { InstagramComment } from '@/lib/instagram/api'
import { pickWinners, GiveawayResult } from '@/lib/giveaway/logic'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trophy, MessageCircle } from 'lucide-react'
import confetti from 'canvas-confetti' // We need to install this

interface Props {
  comments: InstagramComment[]
}

export function GiveawayEngine({ comments }: Props) {
  const [numWinners, setNumWinners] = useState(1)
  const [minMentions, setMinMentions] = useState(1)
  const [allowMultipleEntries, setAllowMultipleEntries] = useState(false)
  
  const [result, setResult] = useState<GiveawayResult | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  const handleDraw = () => {
    setIsDrawing(true)
    setResult(null)
    
    // Fake a small delay for suspense
    setTimeout(() => {
      const res = pickWinners(comments, {
        numWinners,
        minMentions,
        allowMultipleEntries
      })
      setResult(res)
      setIsDrawing(false)
      
      if (res.winners.length > 0) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        })
      }
    }, 1500)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
      {/* Configuration Sidebar */}
      <div className="md:col-span-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Giveaway Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="numWinners">Number of Winners</Label>
              <Input 
                id="numWinners" 
                type="number" 
                min={1} 
                max={50} 
                value={numWinners} 
                onChange={(e) => setNumWinners(parseInt(e.target.value) || 1)} 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="minMentions">Minimum @mentions Required</Label>
              <Input 
                id="minMentions" 
                type="number" 
                min={0} 
                max={10} 
                value={minMentions} 
                onChange={(e) => setMinMentions(parseInt(e.target.value) || 0)} 
              />
            </div>
            
            <div className="flex items-center space-x-2 pt-2">
              <input 
                type="checkbox" 
                id="allowMultiple" 
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 h-4 w-4"
                checked={allowMultipleEntries}
                onChange={(e) => setAllowMultipleEntries(e.target.checked)}
              />
              <Label htmlFor="allowMultiple" className="font-normal cursor-pointer">
                Allow multiple entries per user
              </Label>
            </div>

            <Button 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-6 text-lg mt-4" 
              onClick={handleDraw}
              disabled={isDrawing || comments.length === 0}
            >
              {isDrawing ? 'Drawing Winners...' : 'Draw Now 🎉'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              <span>Total Comments Loaded</span>
            </div>
            <span className="font-bold text-gray-900">{comments.length}</span>
          </CardContent>
        </Card>
      </div>

      {/* Results Area */}
      <div className="md:col-span-8">
        {isDrawing && (
          <div className="h-64 flex flex-col items-center justify-center space-y-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="text-gray-500 font-medium">Shuffling entries and picking winners...</p>
          </div>
        )}

        {!isDrawing && !result && (
          <div className="h-64 flex flex-col items-center justify-center space-y-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <Trophy className="w-16 h-16 text-gray-300" />
            <p className="text-gray-500 font-medium">Configure your rules and click Draw Now to pick winners.</p>
          </div>
        )}

        {!isDrawing && result && (
          <div className="space-y-6">
            <div className="flex gap-4">
              <Card className="flex-1 bg-green-50 border-green-200">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-green-700 font-medium mb-1">Valid Entries</p>
                  <p className="text-3xl font-bold text-green-900">{result.totalValidEntries}</p>
                </CardContent>
              </Card>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-indigo-600 p-4 text-white flex items-center gap-3">
                <Trophy className="w-6 h-6 text-yellow-300" />
                <h2 className="text-xl font-bold">Winners!</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {result.winners.map((winner, idx) => (
                  <div key={winner.id || idx} className="p-6 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xl">
                      {idx + 1}
                    </div>
                    <div>
                      <a href={`https://instagram.com/${winner.username}`} target="_blank" rel="noreferrer" className="text-lg font-bold text-gray-900 hover:text-indigo-600 hover:underline">
                        @{winner.username}
                      </a>
                      <p className="text-gray-500 mt-1 line-clamp-2">{winner.text}</p>
                    </div>
                  </div>
                ))}
                
                {result.winners.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    No valid entries found matching your criteria.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

# Chaos engineering — controlled faults

Browser console me (sirf current tab/session; band karne par chala jaata hai, students ko URL se on nahi hota):
```js
ES.chaos.set('ai-fail')   // network error (AI Worker tak pahunch hi nahi)
ES.chaos.set('ai-502')    // Worker: Gemini fail
ES.chaos.set('ai-429')    // daily limit
ES.chaos.set('ai-slow')   // 30s timeout
ES.chaos.set('')          // band
ES.debug()                // health + metrics + logs
```

| Fault | Expected behavior | Dekhne wali cheez |
|---|---|---|
| `ai-fail` | har request 3 baar try (backoff), phir "AI server tak pahunch nahi paya"; 3 aise failures ke baad breaker open → "N सेकंड बाद कोशिश करें" bina network call ke | `ES.health().aiBreaker === 'open'` |
| `ai-502` | koi retry nahi (quota bachti hai); Worker ka message dikhta hai; 3 failures par breaker open | `ES.debug().logs` me `rid` |
| `ai-429` | message dikhta hai, breaker band rehta hai (server zinda) | `aiBreaker === 'closed'` |
| `ai-slow` | 30s baad timeout message; breaker failure | metrics `p99` |
| 30s ruko (breaker open) → dobara | half-open: ek probe request jaati hai; `ES.chaos.set('')` ke baad success → breaker closed | `aiBreaker` |
| Offline (DevTools → Network → Offline) | "इंटरनेट बंद है" card, notes/quiz cache se khulte hain, AI turant "Internet बंद है" | offline pill |
| `_config/flags` me `{ai:false}` | AI turant band: "AI अभी बंद है" | `ES.health().flags.ai === false` |

Game day (mahine me ek baar, 15 min): upar ki table ek-ek chalao, jo expected se alag ho use `NOTES-mistakes.md` me likho.

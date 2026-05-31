/**
 * seed-pdf-templates.js
 * ─────────────────────
 * Creates + activates the HAX "Bauhaus Precision" PDF templates
 * for INVOICE, CREDIT_NOTE and QUOTE document types.
 *
 * Usage:  node scripts/seed-pdf-templates.js
 *
 * Requires the API to be running on http://localhost:4000
 * and an ADMIN user with the credentials below.
 */

'use strict'

const http  = require('http')
const https = require('https')

// ── Config ────────────────────────────────────────────────────
const API    = 'http://localhost:4000/api'
const EMAIL  = process.env.ADMIN_EMAIL    || 'hanzel@hax.com.do'
const PASS   = process.env.ADMIN_PASSWORD || process.argv[2] || ''

if (require.main === module && !PASS) {
  console.error('Usage: node scripts/seed-pdf-templates.js <password>')
  process.exit(1)
}

// ── HAX Logo (base64 SVG) ─────────────────────────────────────
const LOGO = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGlkPSJMYXllcl8yIiBkYXRhLW5hbWU9IkxheWVyIDIiIHZpZXdCb3g9IjAgMCAxMDggNjYuNSI+CiAgPGRlZnM+CiAgICA8c3R5bGU+CiAgICAgIC5jbHMtMSB7CiAgICAgICAgZmlsbDogIzE3Mzk0ZjsKICAgICAgICBzdHJva2Utd2lkdGg6IDBweDsKICAgICAgfQogICAgPC9zdHlsZT4KICA8L2RlZnM+CiAgPGcgaWQ9IkxheWVyXzEtMiIgZGF0YS1uYW1lPSJMYXllciAxIj4KICAgIDxnPgogICAgICA8Zz4KICAgICAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Im0xLjM2LDUwLjIxYy42Mi0uMjkuOTctLjQ1LDEuMDQtLjUuMDctLjA1LjIzLS4xNC40Ny0uMjkuMjQtLjE0LjQxLS4yNi41LS4zNi4xLS4xLjI0LS4yMy40My0uMzkuMTktLjE3LjMyLS4zMy4zOS0uNS4wNy0uMTcuMTUtLjM2LjI1LS41Ny4xLS4yMi4xNy0uNDUuMjItLjcyLjA1LS4yNi4wNy0uNTQuMDctLjgyVjEwLjI2YzAtLjY3LS4yNC0xLjI0LS43Mi0xLjcyLS40OC0uNDgtMS4wNS0uNzItMS43Mi0uNzJIMGMxLS42MiwyLjgxLTEuNzksNS40MS0zLjUxLDIuNjEtMS43Miw0LjYzLTMuMDYsNi4wNi00LjAyLjYyLS4zOCwxLjI2LS4zOSwxLjktLjA0LjY1LjM2Ljk3LjkuOTcsMS42MXYyMi44Yy41Ny0uNjIsMS4xLTEuMTYsMS41OC0xLjYxLjQ4LS40NSwxLjA0LS45NiwxLjY5LTEuNTEuNjUtLjU1LDEuMjUtMS4wMywxLjgzLTEuNDMuNTctLjQxLDEuMTktLjgsMS44Ni0xLjE4LjY3LS4zOCwxLjM0LS42OSwyLjAxLS45My42Ny0uMjQsMS4zOS0uNDIsMi4xNS0uNTQuNzYtLjEyLDEuNTQtLjE1LDIuMzMtLjExLjc5LjA1LDEuNjEuMTcsMi40Ny4zNiwyLjc3Ljc3LDQuODgsMi4zOCw2LjMxLDQuODQsMS40MywyLjQ2LDIuMTUsNS40MSwyLjE1LDguODZ2MTcuMTRjMCwyLjY4LjMzLDUuMjgsMSw3LjgyLjY3LDIuNTMsMS44Miw0LjczLDMuNDQsNi42LDEuNjMsMS44NiwzLjU2LDIuODIsNS44MSwyLjg3LDEuMzkuMDUsMi43NS0uMjIsNC4wOS0uNzksMS4zNC0uNTcsMi4yLTEuMzIsMi41OC0yLjIyLjE5LS40OC4xLS45OS0uMjktMS41NC0uMzgtLjU1LS45NC0xLjIzLTEuNjktMi4wNC0uNzQtLjgxLTEuMjgtMS41NS0xLjYxLTIuMjItLjkxLTEuNjctLjg3LTMuMDUuMTEtNC4xMi45OC0xLjA4LDIuNTUtMS42Niw0LjctMS43NiwxLjUzLS4wNSwyLjg5LjI2LDQuMDkuOTMsMS4xOS42NywyLDEuNjUsMi40LDIuOTRzLjA4LDIuODctLjk3LDQuNzNjLTEuNTgsMi43Ny00LjE1LDQuNzItNy43MSw1Ljg0LTMuNTYsMS4xMi03LjMzLDEuMjEtMTEuMy4yNS0yLjI1LS41My00LjI0LTEuNS01Ljk5LTIuOS0xLjc1LTEuNDEtMy4xMS0yLjkzLTQuMDktNC41NS0uOTgtMS42My0xLjc5LTMuNDMtMi40NC01LjQxLS42NS0xLjk4LTEuMDktMy42Ni0xLjMzLTUuMDItLjI0LTEuMzYtLjM4LTIuNjktLjQzLTMuOTh2LTE0LjA2YzAtNS41LTEuMjQtOC43Mi0zLjczLTkuNjgtLjYyLS4yNC0xLjI1LS4zNS0xLjktLjMyLS42NS4wMi0xLjIyLjA4LTEuNzIuMTgtLjUuMS0xLjA5LjM1LTEuNzYuNzUtLjY3LjQxLTEuMTguNzQtMS41NCwxLS4zNi4yNi0uODguNzItMS41OCwxLjM2LS42OS42NS0xLjE0LDEuMDYtMS4zMywxLjI1LS4xOS4xOS0uNi42Mi0xLjIyLDEuMjl2MjAuM2MwLC4yOS4wMS41Ni4wNC44Mi4wMi4yNi4xLjUuMjIuNzIuMTIuMjIuMjIuNDEuMjkuNTcuMDcuMTcuMi4zMy4zOS41LjE5LjE3LjMyLjMuMzkuMzkuMDcuMS4yNC4yMi41LjM2LjI2LjE0LjQzLjI0LjUuMjkuMDcuMDUuMjUuMTQuNTQuMjlzLjQ1LjIyLjUuMjJIMS4zNloiPjwvcGF0aD4KICAgICAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Im03NS4wOCw0NS45MWMwLC4yOS4wMi41NS4wNy43OS4wNS4yNC4xLjQ1LjE0LjY1LjA1LjE5LjEzLjM4LjI1LjU3LjEyLjE5LjIyLjM1LjI5LjQ3LjA3LjEyLjIuMjUuMzkuMzkuMTkuMTQuMzMuMjYuNDMuMzYuMS4xLjI1LjIuNDcuMzIuMjIuMTIuMzYuMTkuNDMuMjIuMDcuMDIuMjMuMS40Ny4yMi4yNC4xMi40MS4yLjUuMjVoLTguODljLTEuMTUsMC0yLjEzLS40Mi0yLjk0LTEuMjUtLjgxLS44NC0xLjIyLTEuODMtMS4yMi0yLjk4di0yLjA4Yy00LjAyLDQuMjEtOC4wMSw2LjMxLTExLjk4LDYuMzEtMy41NCwwLTYuNjEtMS4xOS05LjIyLTMuNTktMi42MS0yLjM5LTMuODgtNS4wOS0zLjg0LTguMS4wNS0xLjk2LjYtMy41NiwxLjY1LTQuOCwxLjA1LTEuMjQsMi4zOS0yLjEsNC4wMi0yLjU4LDEuNTMtLjQ4LDQuMzctLjg2LDguNTMtMS4xNSw0LjE2LS4yOSw2Ljk2LS44MSw4LjM5LTEuNTgsMS40My0uODEsMi4yMS0xLjg2LDIuMzMtMy4xNi4xMi0xLjI5LS4zOS0yLjQ2LTEuNTQtMy41MS0xLS45MS0yLjMxLTEuNTgtMy45MS0yLjAxLTEuNi0uNDMtMy4wNy0uNTUtNC40MS0uMzYsMi4zOS0uOTEsNC43NC0xLjIyLDcuMDYtLjkzLDIuMzIuMjksNC40MS45Myw2LjI3LDEuOTQsMS44NiwxLDMuMzcsMi41MSw0LjUyLDQuNTJzMS43Miw0LjI4LDEuNzIsNi44MXYxNC4yN1ptOC4wMy0yMS41OWMtMS43Ny0zLjItNC41NC01LjU4LTguMzItNy4xNC0zLjc4LTEuNTUtNy42Ny0yLjE2LTExLjY5LTEuODMtMi45Mi4yOS01LjMyLDEuMjItNy4yMSwyLjgtMS44OSwxLjU4LTIuODYsMy42OC0yLjksNi4zMSwwLDEuMTUtLjM4LDIuMTQtMS4xNSwyLjk4LS43Ni44NC0xLjcsMS4yNi0yLjgsMS4yNi0xLjM0LDAtMi4yNy0uNTctMi44LTEuNzItLjUzLTEuMTUtLjQ4LTIuMzIuMTQtMy41MS42Mi0xLjQ4LDEuNzQtMi44NiwzLjM3LTQuMTIsMS42Mi0xLjI3LDMuNTYtMi4zMiw1LjgxLTMuMTYsMi4yNS0uODQsNC42OC0xLjQ1LDcuMzEtMS44MywyLjM5LS4zOCw0Ljg2LS41OSw3LjQyLS42MSwyLjU2LS4wMiw1LjIxLjEzLDcuOTYuNDcsMi43NS4zMyw1LjI0LDEuMDgsNy40NiwyLjIyLDIuMjIsMS4xNSwzLjg0LDIuNjUsNC44NCw0LjUyLjM4LjcyLjc5LDEuNDgsMS4yMiwyLjI5LjQzLjgxLjkxLDEuNzEsMS40MywyLjY1LjUzLjk2Ljk0LDEuNzIsMS4yMiwyLjI5LjQ4Ljg2LjgxLDEuNTEsMSwxLjk0LDIuMi0zLjAxLDMuODUtNS4yNiw0Ljk1LTYuNzQuNDMtLjUzLjYzLTEuMDQuNjEtMS41NC0uMDMtLjUtLjI4LTEuMTYtLjc1LTEuOTctLjY3LTEuMTUtMS4xNy0yLjAxLTEuNTEtMi41OGg2Ljg4Yy0xLjEsMS40OC0yLjc1LDMuNjktNC45NSw2LjYzLTIuMiwyLjk0LTMuODUsNS4xNS00Ljk1LDYuNjMsMy4xNiw1Ljc5LDYuNDEsMTEuNzYsOS43NSwxNy45My40OC45MSwxLjI0LDEuMzYsMi4yOSwxLjM2aC4yMnYuMjloLTEyLjkxdi0uMjloLjIyYy4zMywwLC41OS0uMTQuNzUtLjQzLjE3LS4yOS4xOC0uNTcuMDQtLjg2LS43Mi0xLjI5LTEuNzctMy4yNC0zLjE2LTUuODQtMS4zOS0yLjYxLTIuNDQtNC41OC0zLjE2LTUuOTItLjU3LjgxLTEuNDYsMi4wMi0yLjY1LDMuNjItMS4yLDEuNi0yLjA4LDIuNzktMi42NSwzLjU1LS40My41Ny0uNjMsMS4xMS0uNjEsMS42MXMuMjcsMS4xNi43NSwxLjk3Yy41My44NiwxLjAzLDEuNzIsMS41MSwyLjU4aC02Ljg4YzEuMjQtMS42NywzLjAyLTQuMDUsNS4zNC03LjE0LDIuMzItMy4wOCwzLjk4LTUuMjksNC45OC02LjYzLTIuMzQtNC40LTQuMTEtNy43LTUuMzEtOS45LS4xNC0uMjktLjM2LS42OC0uNjUtMS4xOHMtLjQ1LS44Mi0uNS0uOTdabS0xNy42NCwyLjUxYy0uNTcsMS4yNC0xLjUsMi4yOC0yLjc2LDMuMTItMS4yNy44NC0yLjU4LDEuNDgtMy45NCwxLjk0LTEuMzYuNDUtMi43Ljk0LTQuMDIsMS40Ny0xLjMyLjUzLTIuNDEsMS4yMi0zLjMsMi4wOC0uODguODYtMS40LDEuOTQtMS41NCwzLjIzLS4yNCwyLjczLjUxLDUuMDIsMi4yNiw2Ljg4LDEuNzQsMS44NiwzLjkxLDIuNTEsNi40OSwxLjk0LDEuOTYtLjQzLDQuMjMtMi4wMSw2LjgxLTQuNzN2LTE1LjkyWiI+PC9wYXRoPgogICAgICA8L2c+CiAgICAgIDxnPgogICAgICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0ibTY3LDUyLjljLjQsMCwuNzIuMTMuOTguMzkuMjYuMjYuMzkuNTkuNCwxLjAxLDAsLjA2LDAsLjExLDAsLjE1aC0yLjMxYy4wMy4yNi4xMy40Ny4zMS42My4xOC4xNi40LjI0LjY1LjI0LjM2LDAsLjYzLS4xMy44Mi0uMzhsLjMxLjI1Yy0uMTIuMTctLjI5LjMxLS40OS40cy0uNDIuMTQtLjY2LjE0Yy0uMzksMC0uNzItLjE0LTEtLjQxcy0uNDEtLjYxLS40MS0xLC4xMy0uNzQuNC0xLjAyYy4yNy0uMjcuNi0uNDEsMS0uNDFabTAsLjQxYy0uMjMsMC0uNDIuMDctLjU5LjJzLS4yNy4zMS0uMzMuNTRoMS44MmMtLjA1LS4yMi0uMTYtLjQtLjMyLS41NHMtLjM2LS4yLS41OS0uMloiPjwvcGF0aD4KICAgICAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Im03MCw1NS43N2MtLjI3LDAtLjUyLS4wNi0uNzQtLjE5LS4yMi0uMTMtLjM4LS4zMi0uNDYtLjU2bC40My0uMTRjLjEzLjMzLjM5LjQ5Ljc5LjQ5LjIxLDAsLjM3LS4wNC40OS0uMTMuMTItLjA5LjE4LS4yMS4xOC0uMzZzLS4wNy0uMjQtLjItLjI4Yy0uMTMtLjA1LS4zMi0uMDgtLjU2LS4xLS4yNC0uMDItLjQzLS4wNi0uNTUtLjExLS4zLS4xMi0uNDUtLjM0LS40NS0uNjQsMC0uMjMuMS0uNDMuMy0uNTkuMi0uMTYuNDUtLjI1Ljc1LS4yNXMuNTIuMDcuNy4yYy4xOC4xMy4zMS4zMS4zNy41MmwtLjQyLjExYy0uMDQtLjE0LS4xMS0uMjUtLjIyLS4zNC0uMTEtLjA5LS4yNS0uMTMtLjQyLS4xM3MtLjMyLjA1LS40My4xNC0uMTcuMi0uMTcuMzIuMDUuMjIuMTUuMjhjLjEuMDYuMjIuMS4zNS4xMXMuMjkuMDMuNDYuMDVjLjE4LjAyLjMyLjA2LjQyLjEuMjcuMTIuNDEuMzIuNDEuNiwwLC4yNy0uMTEuNDgtLjMyLjY0cy0uNDkuMjUtLjgzLjI1WiI+PC9wYXRoPgogICAgICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0ibTczLjAxLDU1LjY5Yy0uMjYsMC0uNDctLjA3LS42My0uMjItLjE2LS4xNS0uMjQtLjM1LS4yNC0uNjF2LTEuNDVoLS42M3YtLjQzaC42M3YtLjc5aC40OXYuNzloLjc3di40M2gtLjc3djEuMzVjMCwuMzIuMTYuNDguNDkuNDguMDksMCwuMTktLjAyLjMxLS4wNWwuMDUuNDNjLS4xNS4wNS0uMzEuMDctLjQ2LjA3WiI+PC9wYXRoPgogICAgICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0ibTc1LjE5LDU1LjcyYy0uMzYsMC0uNjUtLjExLS44Ny0uMzQtLjIyLS4yMy0uMzMtLjU2LS4zMy0xLjAxdi0xLjM5aC40OXYxLjM1YzAsLjMyLjA3LjU2LjIxLjcycy4zMi4yNC41NS4yNGMuMjQsMCwuNDMtLjA5LjU4LS4yNi4xNS0uMTcuMjItLjQxLjIyLS43MnYtMS4zM2guNDl2Mi43aC0uNDl2LS4zNWgtLjAxYy0uMjIuMjYtLjUxLjM5LS44NS4zOVoiPjwvcGF0aD4KICAgICAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Im03OC41LDU1LjcyYy0uMzcsMC0uNjgtLjEzLS45My0uNHMtLjM3LS42LS4zNy0uOTkuMTItLjcyLjM3LS45OWMuMjUtLjI3LjU2LS40LC45My0uNC40NCwwLC43OC4xNSwxLjA0LjQ0di0xLjhoLjQ5djQuMWgtLjQ5di0uNGMtLjI3LjI5LS42MS40NC0xLjA0LjQ0Wm0tLjU0LS43MWMuMTcuMTguMzkuMjguNjYuMjhzLjQ4LS4wOS42Ni0uMjhjLjE4LS4xOC4yNy0uNDEuMjctLjY4cy0uMDktLjUtLjI3LS42OC0uNC0uMjgtLjY2LS4yOC0uNDguMDktLjY2LjI4Yy0uMTcuMTgtLjI2LjQxLS4yNi42OXMuMDkuNS4yNi42OFoiPjwvcGF0aD4KICAgICAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Im04MS4wNyw1Mi40NWMtLjA4LDAtLjE1LS4wMy0uMi0uMDktLjA2LS4wNi0uMDgtLjEzLS4wOC0uMjEsMC0uMDcuMDMtLjE0LjA4LS4xOS4wNi0uMDYuMTItLjA4LjItLjA4cy4xNS4wMy4yMS4wOC4wOS4xMi4wOS4xOWMwLC4wOC0uMDMuMTUtLjA4LjIxLS4wNi4wNi0uMTMuMDgtLjIxLjA4Wm0tLjIzLDMuMjN2LTIuN2guNDh2Mi43aC0uNDhaIj48L3BhdGg+CiAgICAgICAgPHBhdGggY2xhc3M9ImNscy0xIiBkPSJtODQuNDEsNTUuMzNjLS4yOC4yOC0uNjIuNDItMS4wMS40MnMtLjczLS4xNC0xLjAxLS40MmMtLjI4LS4yOC0uNDItLjYxLS40Mi0xLjAxcy4xNC0uNzMuNDItMS4wMWMuMjgtLjI4LjYxLS40MiwxLjAxLS40MnMuNzMuMTQsMS4wMS40Mi40Mi42MS40MiwxLjAxLS4xNC43My0uNDIsMS4wMVptLTEuNjctLjMyYy4xOC4xOC4zOS4yOC42NS4yOHMuNDgtLjA5LjY2LS4yOGMuMTgtLjE4LjI3LS40MS4yNy0uNjhzLS4wOS0uNS0uMjctLjY4Yy0uMTgtLjE5LS40LS4yOC0uNjYtLjI4cy0uNDguMDktLjY1LjI4LS4yNy40MS0uMjcuNjguMDkuNS4yNy42OFoiPjwvcGF0aD4KICAgICAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Im04OC4xOSw1NS43NGMtLjM5LDAtLjcyLS4xNC0xLS40MnMtLjQyLS42MS0uNDItMS4wMS4xNC0uNzMuNDItMS4wMS42MS0uNDIsMS0uNDJjLjIzLDAsLjQ1LjA1LjY2LjE2LjIuMTEuMzcuMjUuNS40M2wtLjQuM2MtLjE4LS4yNy0uNDMtLjQxLS43Ni0uNDItLjI3LDAtLjQ5LjA5LS42Ny4yOHMtLjI3LjQxLS4yNy42OC4wOS41LjI3LjY4Yy4xOC4xOC40LjI3LjY3LjI4LjM0LDAsLjU5LS4xNC43Ny0uNDJsLjM5LjI5Yy0uMTMuMTgtLjMuMzMtLjUuNDNzLS40Mi4xNi0uNjYuMTZaIj48L3BhdGg+CiAgICAgICAgPHBhdGggY2xhc3M9ImNscy0xIiBkPSJtODkuOTIsNTUuNjh2LTIuN2guNDl2LjM3Yy4yMS0uMjguNTYtLjQyLDEuMDQtLjQxdi41MmMtLjA5LS4wMy0uMi0uMDUtLjMzLS4wNS0uMiwwLS4zNi4wOC0uNS4yMy0uMTQuMTUtLjIxLjM2LS4yMS42MnYxLjQzaC0uNDlaIj48L3BhdGg+CiAgICAgICAgPHBhdGggY2xhc3M9ImNscy0xIiBkPSJtOTMuMjIsNTIuOWMuNCwwLC43Mi4xMy45OC4zOS4yNS4yNi4zOS41OS40LDEuMDEsMCwuMDYsMCwuMTEsMCwuMTVoLTIuMzFjLjAzLjI2LjEzLjQ3LjMxLjYzLjE4LjE2LjQuMjQuNjUuMjQuMzYsMCwuNjMtLjEzLjgyLS4zOGwuMzEuMjVjLS4xMi4xNy0uMjkuMzEtLjQ5LjQtLjIuMDktLjQyLjE0LS42Ni4xNC0uMzksMC0uNzItLjE0LTEtLjQxLS4yOC0uMjctLjQxLS42MS0uNDEtMXMuMTMtLjc0LjQtMS4wMmMuMjctLjI3LjYtLjQxLDEtLjQxWm0wLC40MWMtLjIzLDAtLjQyLjA3LS41OS4ycy0uMjcuMzEtLjMyLjU0aDEuODJjLS4wNS0uMjItLjE2LS40LS4zMi0uNTRzLS4zNi0uMi0uNTktLjJaIj48L3BhdGg+CiAgICAgICAgPHBhdGggY2xhc3M9ImNscy0xIiBkPSJtOTYuMzcsNTUuNzJjLS4zNywwLS42OC0uMTMtLjkzLS40cy0uMzctLjYtLjM3LS45OS4xMi0uNzIuMzctLjk5Yy4yNS0uMjcuNTYtLjQuOTMtLjQuNDQsMCwuNzguMTUsMS4wNC40NHYtLjRoLjQ5djIuN2gtLjQ5di0uNGMtLjI3LjI5LS42MS40NC0xLjA0LjQ0Wm0tLjU1LS43MWMuMTguMTguNC4yOC42Ni4yOHMuNDgtLjA5LjY2LS4yOGMuMTgtLjE4LjI3LS40MS4yNy0uNjhzLS4wOS0uNS0uMjctLjY4LS40LS4yOC0uNjYtLjI4LS40OC4wOS0uNjYuMjgtLjI3LjQxLS4yNy42OC4wOS41LjI3LjY4WiI+PC9wYXRoPgogICAgICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0ibTk5Ljk0LDU1LjY5Yy0uMjYsMC0uNDctLjA3LS42My0uMjItLjE2LS4xNS0uMjQtLjM1LS4yNC0uNjF2LTEuNDVoLS42M3YtLjQzaC42M3YtLjc5aC40OXYuNzloLjc3di40M2gtLjc3djEuMzVjMCwuMzIuMTYuNDguNDkuNDguMDksMCwuMTktLjAyLjMxLS4wNWwuMDUuNDNjLS4xNS4wNS0uMzEuMDctLjQ2LjA3WiI+PC9wYXRoPgogICAgICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0ibTEwMS4yMyw1Mi40NWMtLjA4LDAtLjE1LS4wMy0uMi0uMDlzLS4wOC0uMTMtLjA4LS4yMWMwLS4wNy4wMy0uMTQuMDgtLjE5cy4xMi0uMDguMi0uMDguMTUuMDMuMjEuMDguMDkuMTIuMDkuMTljMCwuMDgtLjAzLjE1LS4wOC4yMXMtLjEzLjA4LS4yMS4wOFptLS4yMywzLjIzdi0yLjdoLjQ4djIuN2gtLjQ4WiI+PC9wYXRoPgogICAgICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0ibTEwMy4xMiw1NS42OGwtMS4xNC0yLjdoLjUxbC45LDIuMjEuOS0yLjIxaC41MmwtMS4xNCwyLjdoLS41NVoiPjwvcGF0aD4KICAgICAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Im0xMDcuNDksNTUuMzNjLS4yOC4yOC0uNjIuNDItMS4wMS40MnMtLjczLS4xNC0xLjAxLS40MmMtLjI4LS4yOC0uNDItLjYxLS40Mi0xLjAxcy4xNC0uNzMuNDItMS4wMWMuMjgtLjI4LjYxLS40MiwxLjAxLS40MnMuNzMuMTQsMS4wMS40Mi40Mi42MS40MiwxLjAxLS4xNC43My0uNDIsMS4wMVptLTEuNjctLjMyYy4xOC4xOC4zOS4yOC42NS4yOHMuNDgtLjA5LjY2LS4yOGMuMTgtLjE4LjI3LS40MS4yNy0uNjhzLS4wOS0uNS0uMjctLjY4Yy0uMTgtLjE5LS40LS4yOC0uNjYtLjI4cy0uNDguMDktLjY1LjI4LS4yNy40MS0uMjcuNjguMDkuNS4yNy42OFoiPjwvcGF0aD4KICAgICAgPC9nPgogICAgPC9nPgogIDwvZz4KPC9zdmc+Cg=='

// ── Shared CSS ────────────────────────────────────────────────
const SHARED_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,300;1,9..144,400&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Instrument+Sans:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
@page{size:8.5in 11in;margin:0}
:root{
  --brand:#293c4f;--brand-mid:#3d5570;--brand-faint:rgba(41,60,79,.06);
  --ink:#111827;--ink2:#374151;--mute:#6b7280;--ghost:#9ca3af;
  --rule:#e5e7eb;--bg:#f9fafb;
  --red:#b91c1c;--green:#166534;--amber:#92400e;
  --mono:'DM Mono',monospace;--sans:'Instrument Sans',sans-serif;--serif:'Fraunces',serif;
}
body{font-family:var(--sans);font-size:9pt;color:var(--ink);width:8.5in;min-height:11in;background:#fff;position:relative;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.wm-brand{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:5.5in;opacity:.03;pointer-events:none;z-index:0}
.wm-text{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-family:var(--sans);font-size:110pt;font-weight:600;letter-spacing:.06em;pointer-events:none;z-index:0;white-space:nowrap;opacity:.055}
.wm-text.red{color:#b91c1c}.wm-text.green{color:#166534}
.page{position:relative;z-index:1;padding:.52in .6in .48in .65in;min-height:11in;display:flex;flex-direction:column}
.page::before{content:'';position:fixed;left:0;top:0;bottom:0;width:4px;background:var(--brand)}
/* header */
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.38in}
.hdr-logo{height:30px;width:auto;display:block;margin-bottom:9px}
.hdr-co-name{font-size:7.5pt;font-weight:600;color:var(--brand);letter-spacing:.09em;text-transform:uppercase}
.hdr-co-meta{font-family:var(--mono);font-size:7pt;color:var(--mute);margin-top:3px;line-height:1.65}
.hdr-right{text-align:right}
.doc-title{font-family:var(--serif);font-style:italic;font-size:28pt;font-weight:300;color:var(--brand);letter-spacing:-.02em;line-height:1;margin-bottom:5px}
.doc-num{font-family:var(--mono);font-size:10.5pt;font-weight:500;color:var(--ink);letter-spacing:.04em}
.doc-bu{font-family:var(--mono);font-size:6.5pt;color:var(--ghost);letter-spacing:.12em;margin-top:4px;text-transform:uppercase}
/* rules */
.rule-brand{height:1.5px;background:var(--brand);margin:.18in 0}
.rule{height:1px;background:var(--rule);margin:.16in 0}
/* info grid */
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:.35in;margin-bottom:.25in}
.sec-label{font-size:6pt;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--brand);margin-bottom:7px;padding-bottom:4px;border-bottom:1px solid var(--brand);display:inline-block}
.client-name{font-size:11pt;font-weight:600;color:var(--ink);margin-bottom:4px}
.meta-line{font-family:var(--mono);font-size:7.5pt;color:var(--mute);line-height:1.7}
.det-row{display:flex;gap:10px;margin-bottom:5px;align-items:baseline}
.det-lbl{font-size:6pt;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ghost);min-width:58px;flex-shrink:0}
.det-val{font-family:var(--mono);font-size:8pt;color:var(--ink)}
.ncf-val{font-family:var(--mono);font-size:9pt;font-weight:500;color:var(--brand);letter-spacing:.04em}
/* original ref */
.orig-ref{background:#fffbeb;border-left:3px solid #f59e0b;padding:8px 12px;margin-bottom:.18in;font-size:7.5pt;color:var(--amber);border-radius:0 2px 2px 0}
/* table */
table{width:100%;border-collapse:collapse;margin-bottom:.22in}
thead tr{border-bottom:2px solid var(--brand)}
th{font-size:6pt;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--brand);padding:5px 7px 7px}
th:first-child{text-align:left;padding-left:0}
th:not(:first-child){text-align:right}
tbody tr{border-bottom:1px solid var(--rule)}
tbody tr:nth-child(even){background:var(--bg)}
td{padding:8px 7px;font-size:8.5pt;vertical-align:top}
td:first-child{text-align:left;padding-left:0}
td:not(:first-child){text-align:right;font-family:var(--mono);font-size:8pt;white-space:nowrap}
.item-desc{color:var(--ink);line-height:1.4}
.item-exempt{font-size:6.5pt;color:var(--ghost);font-style:italic;margin-top:2px}
.exempt-label{color:var(--ghost);font-size:7.5pt}
/* totals */
.totals-wrap{display:flex;justify-content:flex-end;margin-bottom:.28in}
.totals{width:3in}
.t-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--rule)}
.t-row:last-child{border-bottom:none}
.t-lbl{font-size:7.5pt;color:var(--mute);text-transform:uppercase;letter-spacing:.07em}
.t-val{font-family:var(--mono);font-size:8.5pt;color:var(--ink)}
.t-total{background:var(--brand);padding:9px 12px;display:flex;justify-content:space-between;align-items:center;margin-top:3px;border-radius:2px}
.t-total-lbl{font-size:6.5pt;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.75)}
.t-total-val{font-family:var(--mono);font-size:13pt;font-weight:500;color:#fff}
.t-balance{display:flex;justify-content:space-between;padding:5px 12px;background:var(--brand-faint);margin-top:2px}
.t-balance-lbl{font-size:7pt;color:var(--mute);text-transform:uppercase;letter-spacing:.07em}
.t-balance-val{font-family:var(--mono);font-size:7.5pt;color:var(--brand);font-weight:500}
/* discount */
.t-disc{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--rule)}
.t-disc-lbl{font-size:7.5pt;color:#92400e;text-transform:uppercase;letter-spacing:.07em}
.t-disc-val{font-family:var(--mono);font-size:8.5pt;color:#92400e}
/* notes */
.notes{margin-bottom:.25in}
.notes-lbl{font-size:6pt;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--brand);margin-bottom:6px}
.notes-body{font-size:8pt;color:var(--mute);line-height:1.6;padding:9px 12px;background:var(--bg);border-left:2px solid var(--rule)}
/* footer */
.footer{margin-top:auto;padding-top:.14in;border-top:1.5px solid var(--brand);display:flex;justify-content:space-between;align-items:center}
.footer-brand{font-size:7pt;font-weight:600;color:var(--brand);letter-spacing:.1em;text-transform:uppercase}
.footer-meta{font-family:var(--mono);font-size:6.5pt;color:var(--ghost);text-align:right;line-height:1.65}
`

// ── INVOICE Template ──────────────────────────────────────────
const INVOICE_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${SHARED_CSS}</style></head>
<body>

{{#if isCancelled}}<div class="wm-text red">ANULADA</div>{{/if}}
{{#if isPaid}}<div class="wm-text green">PAGADA</div>{{/if}}
<img class="wm-brand" src="${LOGO}" alt=""/>

<div class="page">

<div class="hdr">
  <div>
    <img class="hdr-logo" src="${LOGO}" alt="HAX"/>
    <div class="hdr-co-name">{{company.name}}</div>
    <div class="hdr-co-meta">RNC {{company.rnc}}{{#if company.address}}<br>{{company.address}}{{/if}}</div>
  </div>
  <div class="hdr-right">
    <div class="doc-title">Factura</div>
    <div class="doc-num">{{invoice.number}}</div>
    <div class="doc-bu">{{invoice.businessUnit}}</div>
  </div>
</div>

<div class="rule-brand"></div>

{{#if originalNcf}}
<div class="orig-ref"><strong>Nota de Crédito</strong> — Factura de referencia NCF: {{originalNcf}}</div>
{{/if}}

<div class="info-grid">
  <div>
    <div class="sec-label">Facturar a</div>
    <div class="client-name">{{client.name}}</div>
    {{#if client.rnc}}<div class="meta-line">RNC {{client.rnc}}</div>{{/if}}
    {{#if client.email}}<div class="meta-line">{{client.email}}</div>{{/if}}
  </div>
  <div>
    <div class="sec-label">Detalles del documento</div>
    {{#if invoice.ncf}}
    <div class="det-row"><span class="det-lbl">NCF</span><span class="ncf-val">{{invoice.ncf}}</span></div>
    {{/if}}
    <div class="det-row"><span class="det-lbl">Emisión</span><span class="det-val">{{date invoice.issueDate}}</span></div>
    {{#if invoice.dueDate}}<div class="det-row"><span class="det-lbl">Vencimiento</span><span class="det-val">{{date invoice.dueDate}}</span></div>{{/if}}
    {{#if invoice.paymentTerms}}<div class="det-row"><span class="det-lbl">Condición</span><span class="det-val">{{invoice.paymentTerms}}</span></div>{{/if}}
  </div>
</div>

<div class="rule"></div>

<table>
  <thead><tr>
    <th>Descripción</th>
    <th>Cant.</th>
    <th>Precio Unit.</th>
    <th>ITBIS</th>
    <th>Total</th>
  </tr></thead>
  <tbody>
    {{#each items}}
    <tr>
      <td class="item-desc">{{description}}{{#if isExempt}}<div class="item-exempt">Exento de ITBIS</div>{{/if}}</td>
      <td>{{quantity}}</td>
      <td>{{fmt unitPrice}}</td>
      <td>{{#if isExempt}}<span class="exempt-label">Exento</span>{{else}}{{fmt taxAmount}}{{/if}}</td>
      <td>{{fmt total}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>

<div class="totals-wrap">
  <div class="totals">
    <div class="t-row"><span class="t-lbl">Subtotal</span><span class="t-val">{{fmt invoice.subtotal}}</span></div>
    {{#if invoice.discountAmount}}<div class="t-disc"><span class="t-disc-lbl">Descuento</span><span class="t-disc-val">-{{fmt invoice.discountAmount}}</span></div>{{/if}}
    <div class="t-row"><span class="t-lbl">ITBIS (18%)</span><span class="t-val">{{fmt invoice.taxAmount}}</span></div>
    <div class="t-total">
      <span class="t-total-lbl">Total</span>
      <span class="t-total-val">{{fmt invoice.total}}</span>
    </div>
    {{#if invoice.amountPaid}}
    <div class="t-balance"><span class="t-balance-lbl">Pagado</span><span class="t-balance-val">{{fmt invoice.amountPaid}}</span></div>
    <div class="t-balance"><span class="t-balance-lbl">Saldo pendiente</span><span class="t-balance-val">{{fmt invoice.amountDue}}</span></div>
    {{/if}}
  </div>
</div>

{{#if invoice.notes}}
<div class="notes">
  <div class="notes-lbl">Notas</div>
  <div class="notes-body">{{invoice.notes}}</div>
</div>
{{/if}}

<div class="footer">
  <div class="footer-brand">{{company.name}} &middot; RNC {{company.rnc}}</div>
  <div class="footer-meta">Generado: {{dateShort generatedAt}}</div>
</div>

</div>
</body></html>`

// ── CREDIT NOTE Template ──────────────────────────────────────
const CREDIT_NOTE_HTML = INVOICE_HTML
  .replace('<div class="doc-title">Factura</div>', '<div class="doc-title">Nota de<br>Crédito</div>')

// ── QUOTE Template ────────────────────────────────────────────
const QUOTE_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${SHARED_CSS}
.status-badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:6.5pt;font-weight:600;letter-spacing:.1em;text-transform:uppercase;margin-top:4px}
.badge-accepted{background:#dcfce7;color:#166534}
.badge-rejected{background:#fee2e2;color:#991b1b}
.badge-sent{background:#dbeafe;color:#1e40af}
.badge-draft{background:#f3f4f6;color:#374151}
.badge-expired{background:#fff7ed;color:#c2410c}
.badge-converted{background:#f5f3ff;color:#6d28d9}
.validity{font-size:7pt;color:var(--ghost);margin-top:3px;font-family:var(--mono)}
.terms{margin-bottom:.22in}
.terms-lbl{font-size:6pt;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--brand);margin-bottom:6px}
.terms-body{font-size:7.5pt;color:var(--mute);line-height:1.6;padding:9px 12px;background:var(--bg);border-left:2px solid var(--rule)}
</style></head>
<body>

{{#if isRejected}}<div class="wm-text red">RECHAZADA</div>{{/if}}
{{#if isConverted}}<div class="wm-text" style="color:#6d28d9;opacity:.05">CONVERTIDA</div>{{/if}}
<img class="wm-brand" src="${LOGO}" alt=""/>

<div class="page">

<div class="hdr">
  <div>
    <img class="hdr-logo" src="${LOGO}" alt="HAX"/>
    <div class="hdr-co-name">{{company.name}}</div>
    <div class="hdr-co-meta">RNC {{company.rnc}}{{#if company.address}}<br>{{company.address}}{{/if}}</div>
  </div>
  <div class="hdr-right">
    <div class="doc-title">Cotización</div>
    <div class="doc-num">{{quote.number}}</div>
    <div class="doc-bu">{{quote.businessUnit}}</div>
    {{#ifEq quote.status "ACEPTADA"}}<span class="status-badge badge-accepted">Aceptada</span>{{/ifEq}}
    {{#ifEq quote.status "RECHAZADA"}}<span class="status-badge badge-rejected">Rechazada</span>{{/ifEq}}
    {{#ifEq quote.status "ENVIADA"}}<span class="status-badge badge-sent">Enviada</span>{{/ifEq}}
    {{#ifEq quote.status "BORRADOR"}}<span class="status-badge badge-draft">Borrador</span>{{/ifEq}}
    {{#ifEq quote.status "VENCIDA"}}<span class="status-badge badge-expired">Vencida</span>{{/ifEq}}
    {{#ifEq quote.status "CONVERTIDA"}}<span class="status-badge badge-converted">Convertida</span>{{/ifEq}}
  </div>
</div>

<div class="rule-brand"></div>

<div class="info-grid">
  <div>
    <div class="sec-label">Dirigida a</div>
    <div class="client-name">{{client.name}}</div>
    {{#if client.rnc}}<div class="meta-line">RNC {{client.rnc}}</div>{{/if}}
    {{#if client.email}}<div class="meta-line">{{client.email}}</div>{{/if}}
    {{#if client.phone}}<div class="meta-line">{{client.phone}}</div>{{/if}}
  </div>
  <div>
    <div class="sec-label">Detalles</div>
    <div class="det-row"><span class="det-lbl">Fecha</span><span class="det-val">{{date quote.createdAt}}</span></div>
    {{#if quote.validUntil}}<div class="det-row"><span class="det-lbl">Válida hasta</span><span class="det-val">{{date quote.validUntil}}</span></div>{{/if}}
  </div>
</div>

<div class="rule"></div>

<table>
  <thead><tr>
    <th>Descripción</th>
    <th>Cant.</th>
    <th>Precio Unit.</th>
    <th>ITBIS</th>
    <th>Total</th>
  </tr></thead>
  <tbody>
    {{#each items}}
    <tr>
      <td class="item-desc">{{description}}{{#if isExempt}}<div class="item-exempt">Exento de ITBIS</div>{{/if}}</td>
      <td>{{quantity}}</td>
      <td>{{fmt unitPrice}}</td>
      <td>{{#if isExempt}}<span class="exempt-label">Exento</span>{{else}}{{fmt taxAmount}}{{/if}}</td>
      <td>{{fmt total}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>

<div class="totals-wrap">
  <div class="totals">
    <div class="t-row"><span class="t-lbl">Subtotal</span><span class="t-val">{{fmt quote.subtotal}}</span></div>
    <div class="t-row"><span class="t-lbl">ITBIS (18%)</span><span class="t-val">{{fmt quote.taxAmount}}</span></div>
    <div class="t-total">
      <span class="t-total-lbl">Total estimado</span>
      <span class="t-total-val">{{fmt quote.total}}</span>
    </div>
  </div>
</div>

{{#if quote.terms}}
<div class="terms">
  <div class="terms-lbl">Términos y condiciones</div>
  <div class="terms-body">{{quote.terms}}</div>
</div>
{{/if}}

{{#if quote.notes}}
<div class="notes">
  <div class="notes-lbl">Notas</div>
  <div class="notes-body">{{quote.notes}}</div>
</div>
{{/if}}

<div class="footer">
  <div class="footer-brand">{{company.name}} &middot; RNC {{company.rnc}}</div>
  <div class="footer-meta">Cotización generada {{dateShort generatedAt}}<br>No es un comprobante fiscal</div>
</div>

</div>
</body></html>`

// ── HTTP helpers ──────────────────────────────────────────────
function request(method, url, body, token) {
  return new Promise((resolve, reject) => {
    const u    = new URL(url)
    const data = body ? JSON.stringify(body) : null
    const opts = {
      hostname: u.hostname, port: u.port || 80, path: u.pathname,
      method, headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }
    const req = (u.protocol === 'https:' ? https : http).request(opts, res => {
      let raw = ''
      res.on('data', c => raw += c)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }) }
        catch { resolve({ status: res.statusCode, body: raw }) }
      })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  // 1. Login
  console.log('🔑  Logging in...')
  const login = await request('POST', `${API}/auth/login`, { email: EMAIL, password: PASS })
  if (login.status !== 200) { console.error('Login failed:', login.body); process.exit(1) }
  const token = login.body.data?.accessToken || login.body.accessToken
  console.log('✅  Authenticated')

  const templates = [
    { type: 'INVOICE',     name: 'HAX Bauhaus — Factura',       html: INVOICE_HTML },
    { type: 'CREDIT_NOTE', name: 'HAX Bauhaus — Nota de Crédito', html: CREDIT_NOTE_HTML },
    { type: 'QUOTE',       name: 'HAX Bauhaus — Cotización',    html: QUOTE_HTML },
  ]

  for (const tpl of templates) {
    console.log(`\n📄  Processing ${tpl.type}...`)

    // 2. Create template
    const create = await request('POST', `${API}/pdf-templates`, {
      type: tpl.type, name: tpl.name,
      description: 'Diseño Bauhaus Precision — carta 8.5×11in, DM Mono + Instrument Sans + Fraunces',
      html: tpl.html,
    }, token)

    if (create.status !== 201) {
      console.error(`  ❌ Create failed (${create.status}):`, JSON.stringify(create.body).slice(0, 200))
      continue
    }

    const id = create.body.data?.id || create.body.id
    console.log(`  ✅ Created  id=${id}`)

    // 3. Activate
    const activate = await request('POST', `${API}/pdf-templates/${id}/activate`, null, token)
    if (activate.status !== 200) {
      console.error(`  ❌ Activate failed (${activate.status}):`, JSON.stringify(activate.body).slice(0, 200))
      continue
    }
    console.log(`  🟢 Activated`)
  }

  console.log('\n🎉  Done! All templates active. Regenerate PDFs to see the new design.')
}

main().catch(e => { console.error(e); process.exit(1) })

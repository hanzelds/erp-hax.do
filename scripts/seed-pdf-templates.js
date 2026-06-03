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
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura {{invoice.number}} — HAX Estudio Creativo</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: 8.5in 11in; margin: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .inv {
      background: #fff;
      width: 8.5in;
      min-height: 11in;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .inv-watermark {
      display: none;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-35deg);
      font-size: 96px;
      font-weight: 700;
      letter-spacing: 0.08em;
      pointer-events: none;
      z-index: 100;
      white-space: nowrap;
      opacity: 0.07;
    }
    {{#if isPaid}}.inv-watermark { display: block; color: #15803d; }{{/if}}
    {{#if isCancelled}}.inv-watermark { display: block; color: #991b1b; }{{/if}}
    .inv-header {
      padding: 32px 40px 28px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #17394f;
    }
    .inv-logo svg { width: 100px; height: auto; display: block; }
    .inv-logo-meta { font-size: 10px; color: #94a3b8; margin-top: 5px; letter-spacing: 0.03em; line-height: 1.7; }
    .inv-doc { text-align: right; }
    .inv-doc-type { font-size: 9.5px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #94a3b8; }
    .inv-ncf { font-size: 26px; font-weight: 700; color: #17394f; letter-spacing: -0.5px; line-height: 1.1; margin-top: 3px; }
    .inv-num { font-size: 11px; color: #64748b; margin-top: 4px; }
    .inv-badges { display: flex; gap: 6px; justify-content: flex-end; margin-top: 8px; flex-wrap: wrap; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 3px; font-size: 9.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
    .badge-approved  { background: #dcfce7; color: #15803d; }
    .badge-draft     { background: #f1f5f9; color: #64748b; }
    .badge-cancelled { background: #fee2e2; color: #991b1b; }
    .badge-paid      { background: #dcfce7; color: #15803d; }
    .badge-partial   { background: #dbeafe; color: #1d4ed8; }
    .badge-pending   { background: #fef9c3; color: #854d0e; }
    .inv-bu { background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 8px 40px; display: flex; align-items: center; gap: 8px; }
    .inv-bu-label { font-size: 9px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; }
    .inv-bu-dot { font-size: 10px; color: #94a3b8; }
    .inv-bu-val { font-size: 11px; font-weight: 500; color: #475569; }
    .inv-client { padding: 0 40px; border-bottom: 1px solid #e5e7eb; }
    .inv-client-inner { display: grid; grid-template-columns: 1fr 1px 220px; }
    .inv-cl-left  { padding: 24px 32px 24px 0; }
    .inv-cl-divider { background: #e5e7eb; margin: 16px 0; }
    .inv-cl-right { padding: 24px 0 24px 32px; display: flex; flex-direction: column; justify-content: space-between; }
    .lbl { font-size: 9px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #94a3b8; margin-bottom: 7px; display: block; }
    .inv-cl-name { font-size: 14px; font-weight: 600; color: #0f172a; line-height: 1.35; }
    .inv-cl-sub { font-size: 11px; color: #64748b; margin-top: 3px; }
    .inv-date-row { display: flex; justify-content: space-between; align-items: baseline; }
    .inv-date-lbl { font-size: 11px; color: #94a3b8; }
    .inv-date-val { font-size: 13px; font-weight: 500; color: #0f172a; }
    .inv-pay-block { padding-top: 13px; border-top: 1px solid #f1f5f9; }
    .inv-pay-val   { font-size: 13px; font-weight: 600; color: #17394f; }
    .inv-pay-sub   { font-size: 11px; color: #64748b; margin-top: 2px; }
    .inv-items-head { background: #f8fafc; padding: 10px 40px; display: grid; grid-template-columns: 1fr 52px 108px 108px 108px; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
    .inv-items-head span { font-size: 9.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #94a3b8; }
    .inv-items-head span:not(:first-child) { text-align: right; }
    .inv-row { padding: 12px 40px; display: grid; grid-template-columns: 1fr 52px 108px 108px 108px; border-bottom: 1px solid #f1f5f9; align-items: center; }
    .inv-row:nth-child(odd)  { background: #fafbfc; }
    .inv-row:last-child      { border-bottom: none; }
    .inv-row-desc  { font-size: 12.5px; font-weight: 500; color: #0f172a; }
    .inv-row-exempt { font-size: 10px; color: #15803d; font-weight: 500; margin-top: 2px; }
    .inv-row-qty   { font-size: 12.5px; color: #94a3b8; text-align: right; }
    .inv-row-price { font-size: 12.5px; color: #64748b; text-align: right; }
    .inv-row-tax   { font-size: 12.5px; color: #94a3b8; text-align: right; line-height: 1.6; }
    .inv-row-tax-rate { font-size: 9.5px; color: #94a3b8; display: block; }
    .inv-row-tax-exempt { font-size: 11px; color: #15803d; text-align: right; font-weight: 500; }
    .inv-row-total { font-size: 13px; font-weight: 600; color: #17394f; text-align: right; }
    .inv-totals-wrap { display: flex; justify-content: flex-end; padding: 20px 40px 0; }
    .inv-totals { width: 270px; }
    .inv-tot-row  { display: flex; justify-content: space-between; font-size: 12.5px; padding: 7px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; }
    .inv-tot-paid { display: flex; justify-content: space-between; font-size: 12.5px; padding: 7px 0; border-bottom: 1px solid #f1f5f9; color: #15803d; font-weight: 500; }
    .inv-tot-due  { display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; color: #17394f; padding-top: 12px; border-top: 2px solid #17394f; margin-top: 4px; }
    .inv-notes { padding: 16px 40px 24px; border-top: 1px solid #f1f5f9; }
    .inv-notes-text { font-size: 11.5px; color: #64748b; line-height: 1.6; font-style: italic; }
    .inv-orig-ref { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 8px 12px 8px 40px; font-size: 11px; color: #92400e; }
    .inv-footer { background: #17394f; padding: 14px 40px; display: flex; justify-content: space-between; align-items: center; margin-top: auto; }
    .inv-footer-left { font-size: 10px; color: rgba(255,255,255,0.5); }
    .inv-footer-right { display: flex; align-items: center; gap: 8px; }
    .inv-footer-right svg { width: 30px; height: auto; }
    .inv-footer-right span { font-size: 10px; color: rgba(255,255,255,0.5); }
    .mt-10 { margin-top: 10px; }
  </style>
</head>
<body>
<div class="inv">

  <div class="inv-watermark">{{#if isPaid}}PAGADA{{/if}}{{#if isCancelled}}ANULADA{{/if}}</div>

  <div class="inv-header">
    <div class="inv-logo">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 66.5">
        <defs><style>.lc{fill:#17394f;stroke-width:0px;}</style></defs>
        <g><g><g>
          <path class="lc" d="m1.36,50.21c.62-.29.97-.45,1.04-.5.07-.05.23-.14.47-.29.24-.14.41-.26.5-.36.1-.1.24-.23.43-.39.19-.17.32-.33.39-.5.07-.17.15-.36.25-.57.1-.22.17-.45.22-.72.05-.26.07-.54.07-.82V10.26c0-.67-.24-1.24-.72-1.72-.48-.48-1.05-.72-1.72-.72H0c1-.62,2.81-1.79,5.41-3.51,2.61-1.72,4.63-3.06,6.06-4.02.62-.38,1.26-.39,1.9-.04.65.36.97.9.97,1.61v22.8c.57-.62,1.1-1.16,1.58-1.61.48-.45,1.04-.96,1.69-1.51.65-.55,1.25-1.03,1.83-1.43.57-.41,1.19-.8,1.86-1.18.67-.38,1.34-.69,2.01-.93.67-.24,1.39-.42,2.15-.54.76-.12,1.54-.15,2.33-.11.79.05,1.61.17,2.47.36,2.77.77,4.88,2.38,6.31,4.84,1.43,2.46,2.15,5.41,2.15,8.86v17.14c0,2.68.33,5.28,1,7.82.67,2.53,1.82,4.73,3.44,6.6,1.63,1.86,3.56,2.82,5.81,2.87,1.39.05,2.75-.22,4.09-.79,1.34-.57,2.2-1.32,2.58-2.22.19-.48.1-.99-.29-1.54-.38-.55-.94-1.23-1.69-2.04-.74-.81-1.28-1.55-1.61-2.22-.91-1.67-.87-3.05.11-4.12.98-1.08,2.55-1.66,4.7-1.76,1.53-.05,2.89.26,4.09.93,1.19.67,2,1.65,2.4,2.94s.08,2.87-.97,4.73c-1.58,2.77-4.15,4.72-7.71,5.84-3.56,1.12-7.33,1.21-11.3.25-2.25-.53-4.24-1.5-5.99-2.9-1.75-1.41-3.11-2.93-4.09-4.55-.98-1.63-1.79-3.43-2.44-5.41-.65-1.98-1.09-3.66-1.33-5.02-.24-1.36-.38-2.69-.43-3.98v-14.06c0-5.5-1.24-8.72-3.73-9.68-.62-.24-1.25-.35-1.9-.32-.65.02-1.22.08-1.72.18-.5.1-1.09.35-1.76.75-.67.41-1.18.74-1.54,1-.36.26-.88.72-1.58,1.36-.69.65-1.14,1.06-1.33,1.25-.19.19-.6.62-1.22,1.29v20.3c0,.29.01.56.04.82.02.26.1.5.22.72.12.22.22.41.29.57.07.17.2.33.39.5.19.17.32.3.39.39.07.1.24.22.5.36.26.14.43.24.5.29.07.05.25.14.54.29s.45.22.5.22H1.36Z"/>
          <path class="lc" d="m75.08,45.91c0,.29.02.55.07.79.05.24.1.45.14.65.05.19.13.38.25.57.12.19.22.35.29.47.07.12.2.25.39.39.19.14.33.26.43.36.1.1.25.2.47.32.22.12.36.19.43.22.07.02.23.1.47.22.24.12.41.2.5.25h-8.89c-1.15,0-2.13-.42-2.94-1.25-.81-.84-1.22-1.83-1.22-2.98v-2.08c-4.02,4.21-8.01,6.31-11.98,6.31-3.54,0-6.61-1.19-9.22-3.59-2.61-2.39-3.88-5.09-3.84-8.1.05-1.96.6-3.56,1.65-4.8,1.05-1.24,2.39-2.1,4.02-2.58,1.53-.48,4.37-.86,8.53-1.15,4.16-.29,6.96-.81,8.39-1.58,1.43-.81,2.21-1.86,2.33-3.16.12-1.29-.39-2.46-1.54-3.51-1-.91-2.31-1.58-3.91-2.01-1.6-.43-3.07-.55-4.41-.36,2.39-.91,4.74-1.22,7.06-.93,2.32.29,4.41.93,6.27,1.94,1.86,1,3.37,2.51,4.52,4.52s1.72,4.28,1.72,6.81v14.27Zm8.03-21.59c-1.77-3.2-4.54-5.58-8.32-7.14-3.78-1.55-7.67-2.16-11.69-1.83-2.92.29-5.32,1.22-7.21,2.8-1.89,1.58-2.86,3.68-2.9,6.31,0,1.15-.38,2.14-1.15,2.98-.76.84-1.7,1.26-2.8,1.26-1.34,0-2.27-.57-2.8-1.72-.53-1.15-.48-2.32.14-3.51.62-1.48,1.74-2.86,3.37-4.12,1.62-1.27,3.56-2.32,5.81-3.16,2.25-.84,4.68-1.45,7.31-1.83,2.39-.38,4.86-.59,7.42-.61,2.56-.02,5.21.13,7.96.47,2.75.33,5.24,1.08,7.46,2.22,2.22,1.15,3.84,2.65,4.84,4.52.38.72.79,1.48,1.22,2.29.43.81.91,1.71,1.43,2.65.53.96.94,1.72,1.22,2.29.48.86.81,1.51,1,1.94,2.2-3.01,3.85-5.26,4.95-6.74.43-.53.63-1.04.61-1.54-.03-.5-.28-1.16-.75-1.97-.67-1.15-1.17-2.01-1.51-2.58h6.88c-1.1,1.48-2.75,3.69-4.95,6.63-2.2,2.94-3.85,5.15-4.95,6.63,3.16,5.79,6.41,11.76,9.75,17.93.48.91,1.24,1.36,2.29,1.36h.22v.29h-12.91v-.29h.22c.33,0,.59-.14.75-.43.17-.29.18-.57.04-.86-.72-1.29-1.77-3.24-3.16-5.84-1.39-2.61-2.44-4.58-3.16-5.92-.57.81-1.46,2.02-2.65,3.62-1.2,1.6-2.08,2.79-2.65,3.55-.43.57-.63,1.11-.61,1.61s.27,1.16.75,1.97c.53.86,1.03,1.72,1.51,2.58h-6.88c1.24-1.67,3.02-4.05,5.34-7.14,2.32-3.08,3.98-5.29,4.98-6.63-2.34-4.4-4.11-7.7-5.31-9.9-.14-.29-.36-.68-.65-1.18s-.45-.82-.5-.97Zm-17.64,2.51c-.57,1.24-1.5,2.28-2.76,3.12-1.27.84-2.58,1.48-3.94,1.94-1.36.45-2.7.94-4.02,1.47-1.32.53-2.41,1.22-3.3,2.08-.88.86-1.4,1.94-1.54,3.23-.24,2.73.51,5.02,2.26,6.88,1.74,1.86,3.91,2.51,6.49,1.94,1.96-.43,4.23-2.01,6.81-4.73v-15.92Z"/>
        </g></g></g>
      </svg>
      <div class="inv-logo-meta">{{company.name}} · RNC {{company.rnc}}<br>{{company.address}}</div>
    </div>
    <div class="inv-doc">
      <div class="inv-doc-type">{{invoice.type}}</div>
      {{#if invoice.ncf}}
        <div class="inv-ncf">{{invoice.ncf}}</div>
        <div class="inv-num">No. {{invoice.number}}</div>
      {{else}}
        <div class="inv-ncf">{{invoice.number}}</div>
      {{/if}}
    </div>
  </div>

  {{#if invoice.businessUnit}}
  <div class="inv-bu">
    <span class="inv-bu-label">Unidad de negocio</span>
    <span class="inv-bu-dot">·</span>
    <span class="inv-bu-val">{{invoice.businessUnit}}</span>
  </div>
  {{/if}}

  {{#if originalNcf}}
  <div class="inv-orig-ref">Nota de Crédito — Factura de referencia NCF: <strong>{{originalNcf}}</strong></div>
  {{/if}}

  <div class="inv-client">
    <div class="inv-client-inner">
      <div class="inv-cl-left">
        <span class="lbl">Facturar a</span>
        <div class="inv-cl-name">{{client.name}}</div>
        {{#if client.rnc}}<div class="inv-cl-sub">RNC {{client.rnc}}</div>{{/if}}
        {{#if client.email}}<div class="inv-cl-sub">{{client.email}}</div>{{/if}}
        {{#if client.phone}}<div class="inv-cl-sub">{{client.phone}}</div>{{/if}}
        {{#if client.address}}<div class="inv-cl-sub">{{client.address}}</div>{{/if}}
      </div>
      <div class="inv-cl-divider"></div>
      <div class="inv-cl-right">
        <div>
          <div class="inv-date-row">
            <span class="inv-date-lbl">Emisión</span>
            <span class="inv-date-val">{{dateShort invoice.issueDate}}</span>
          </div>
          {{#if invoice.dueDate}}
          <div class="inv-date-row mt-10">
            <span class="inv-date-lbl">Vencimiento</span>
            <span class="inv-date-val">{{dateShort invoice.dueDate}}</span>
          </div>
          {{/if}}
        </div>
        <div class="inv-pay-block">
          <span class="lbl">Condición de pago</span>
          <div class="inv-pay-val">{{invoice.paymentTerms}}</div>
          {{#if invoice.dueDate}}<div class="inv-pay-sub">Vence el {{date invoice.dueDate}}</div>{{/if}}
        </div>
      </div>
    </div>
  </div>

  <div class="inv-items-head">
    <span>Descripción</span>
    <span>Cant.</span>
    <span>P. Unit.</span>
    <span>ITBIS</span>
    <span>Total</span>
  </div>

  {{#each items}}
  <div class="inv-row">
    <div>
      <div class="inv-row-desc">{{description}}</div>
      {{#if isExempt}}<div class="inv-row-exempt">✓ Exento de ITBIS</div>{{/if}}
    </div>
    <div class="inv-row-qty">{{num quantity}}</div>
    <div class="inv-row-price">{{fmt unitPrice}}</div>
    <div>
      {{#if isExempt}}
        <div class="inv-row-tax-exempt">Exento</div>
      {{else}}
        <div class="inv-row-tax">{{fmt taxAmount}}</div>
      {{/if}}
    </div>
    <div class="inv-row-total">{{fmt total}}</div>
  </div>
  {{/each}}

  <div class="inv-totals-wrap">
    <div class="inv-totals">
      <div class="inv-tot-row"><span>Subtotal</span><span>{{fmt invoice.subtotal}}</span></div>
      <div class="inv-tot-row"><span>ITBIS</span><span>{{fmt invoice.taxAmount}}</span></div>
      {{#if invoice.amountPaid}}
      <div class="inv-tot-paid"><span>Pagado</span><span>− {{fmt invoice.amountPaid}}</span></div>
      {{/if}}
      <div class="inv-tot-due"><span>Total</span><span>{{fmt invoice.amountDue}}</span></div>
    </div>
  </div>

  {{#if invoice.notes}}
  <div class="inv-notes">
    <span class="lbl">Notas</span>
    <div class="inv-notes-text">{{invoice.notes}}</div>
  </div>
  {{/if}}

  <div class="inv-footer">
    <div class="inv-footer-left">Generado el {{generatedAt}}</div>
    <div class="inv-footer-right">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 66.5">
        <path fill="rgba(255,255,255,0.35)" d="m1.36,50.21c.62-.29.97-.45,1.04-.5.07-.05.23-.14.47-.29.24-.14.41-.26.5-.36.1-.1.24-.23.43-.39.19-.17.32-.33.39-.5.07-.17.15-.36.25-.57.1-.22.17-.45.22-.72.05-.26.07-.54.07-.82V10.26c0-.67-.24-1.24-.72-1.72-.48-.48-1.05-.72-1.72-.72H0c1-.62,2.81-1.79,5.41-3.51,2.61-1.72,4.63-3.06,6.06-4.02.62-.38,1.26-.39,1.9-.04.65.36.97.9.97,1.61v22.8c.57-.62,1.1-1.16,1.58-1.61.48-.45,1.04-.96,1.69-1.51.65-.55,1.25-1.03,1.83-1.43.57-.41,1.19-.8,1.86-1.18.67-.38,1.34-.69,2.01-.93.67-.24,1.39-.42,2.15-.54.76-.12,1.54-.15,2.33-.11.79.05,1.61.17,2.47.36,2.77.77,4.88,2.38,6.31,4.84,1.43,2.46,2.15,5.41,2.15,8.86v17.14c0,2.68.33,5.28,1,7.82.67,2.53,1.82,4.73,3.44,6.6,1.63,1.86,3.56,2.82,5.81,2.87,1.39.05,2.75-.22,4.09-.79,1.34-.57,2.2-1.32,2.58-2.22.19-.48.1-.99-.29-1.54-.38-.55-.94-1.23-1.69-2.04-.74-.81-1.28-1.55-1.61-2.22-.91-1.67-.87-3.05.11-4.12.98-1.08,2.55-1.66,4.7-1.76,1.53-.05,2.89.26,4.09.93,1.19.67,2,1.65,2.4,2.94s.08,2.87-.97,4.73c-1.58,2.77-4.15,4.72-7.71,5.84-3.56,1.12-7.33,1.21-11.3.25-2.25-.53-4.24-1.5-5.99-2.9-1.75-1.41-3.11-2.93-4.09-4.55-.98-1.63-1.79-3.43-2.44-5.41-.65-1.98-1.09-3.66-1.33-5.02-.24-1.36-.38-2.69-.43-3.98v-14.06c0-5.5-1.24-8.72-3.73-9.68-.62-.24-1.25-.35-1.9-.32-.65.02-1.22.08-1.72.18-.5.1-1.09.35-1.76.75-.67.41-1.18.74-1.54,1-.36.26-.88.72-1.58,1.36-.69.65-1.14,1.06-1.33,1.25-.19.19-.6.62-1.22,1.29v20.3c0,.29.01.56.04.82.02.26.1.5.22.72.12.22.22.41.29.57.07.17.2.33.39.5.19.17.32.3.39.39.07.1.24.22.5.36.26.14.43.24.5.29.07.05.25.14.54.29s.45.22.5.22H1.36Z"/>
        <path fill="rgba(255,255,255,0.35)" d="m75.08,45.91c0,.29.02.55.07.79.05.24.1.45.14.65.05.19.13.38.25.57.12.19.22.35.29.47.07.12.2.25.39.39.19.14.33.26.43.36.1.1.25.2.47.32.22.12.36.19.43.22.07.02.23.1.47.22.24.12.41.2.5.25h-8.89c-1.15,0-2.13-.42-2.94-1.25-.81-.84-1.22-1.83-1.22-2.98v-2.08c-4.02,4.21-8.01,6.31-11.98,6.31-3.54,0-6.61-1.19-9.22-3.59-2.61-2.39-3.88-5.09-3.84-8.1.05-1.96.6-3.56,1.65-4.8,1.05-1.24,2.39-2.1,4.02-2.58,1.53-.48,4.37-.86,8.53-1.15,4.16-.29,6.96-.81,8.39-1.58,1.43-.81,2.21-1.86,2.33-3.16.12-1.29-.39-2.46-1.54-3.51-1-.91-2.31-1.58-3.91-2.01-1.6-.43-3.07-.55-4.41-.36,2.39-.91,4.74-1.22,7.06-.93,2.32.29,4.41.93,6.27,1.94,1.86,1,3.37,2.51,4.52,4.52s1.72,4.28,1.72,6.81v14.27Zm8.03-21.59c-1.77-3.2-4.54-5.58-8.32-7.14-3.78-1.55-7.67-2.16-11.69-1.83-2.92.29-5.32,1.22-7.21,2.8-1.89,1.58-2.86,3.68-2.9,6.31,0,1.15-.38,2.14-1.15,2.98-.76.84-1.7,1.26-2.8,1.26-1.34,0-2.27-.57-2.8-1.72-.53-1.15-.48-2.32.14-3.51.62-1.48,1.74-2.86,3.37-4.12,1.62-1.27,3.56-2.32,5.81-3.16,2.25-.84,4.68-1.45,7.31-1.83,2.39-.38,4.86-.59,7.42-.61,2.56-.02,5.21.13,7.96.47,2.75.33,5.24,1.08,7.46,2.22,2.22,1.15,3.84,2.65,4.84,4.52.38.72.79,1.48,1.22,2.29.43.81.91,1.71,1.43,2.65.53.96.94,1.72,1.22,2.29.48.86.81,1.51,1,1.94,2.2-3.01,3.85-5.26,4.95-6.74.43-.53.63-1.04.61-1.54-.03-.5-.28-1.16-.75-1.97-.67-1.15-1.17-2.01-1.51-2.58h6.88c-1.1,1.48-2.75,3.69-4.95,6.63-2.2,2.94-3.85,5.15-4.95,6.63,3.16,5.79,6.41,11.76,9.75,17.93.48.91,1.24,1.36,2.29,1.36h.22v.29h-12.91v-.29h.22c.33,0,.59-.14.75-.43.17-.29.18-.57.04-.86-.72-1.29-1.77-3.24-3.16-5.84-1.39-2.61-2.44-4.58-3.16-5.92-.57.81-1.46,2.02-2.65,3.62-1.2,1.6-2.08,2.79-2.65,3.55-.43.57-.63,1.11-.61,1.61s.27,1.16.75,1.97c.53.86,1.03,1.72,1.51,2.58h-6.88c1.24-1.67,3.02-4.05,5.34-7.14,2.32-3.08,3.98-5.29,4.98-6.63-2.34-4.4-4.11-7.7-5.31-9.9-.14-.29-.36-.68-.65-1.18s-.45-.82-.5-.97Zm-17.64,2.51c-.57,1.24-1.5,2.28-2.76,3.12-1.27.84-2.58,1.48-3.94,1.94-1.36.45-2.7.94-4.02,1.47-1.32.53-2.41,1.22-3.3,2.08-.88.86-1.4,1.94-1.54,3.23-.24,2.73.51,5.02,2.26,6.88,1.74,1.86,3.91,2.51,6.49,1.94,1.96-.43,4.23-2.01,6.81-4.73v-15.92Z"/>
      </svg>
      <span>hax.com.do</span>
    </div>
  </div>

</div>
</body></html>`

// ── CREDIT NOTE Template ──────────────────────────────────────
const CREDIT_NOTE_HTML = INVOICE_HTML
  .replace('<div class="inv-doc-type">{{invoice.type}}</div>', '<div class="inv-doc-type">Nota de Crédito</div>')

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
<img class="wm-brand" src="{{{logo}}}" alt=""/>

<div class="page">

<div class="hdr">
  <div>
    <img class="hdr-logo" src="{{{logo}}}" alt="HAX"/>
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

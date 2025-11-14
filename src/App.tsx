import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import pagesFile from '../form-pages.json'
import './App.css'

type FormItem = {
  area: string
  question: string
  help: string
}

type FormPage = {
  title: string
  items: FormItem[]
}

type FormPagesFile = {
  pages: FormPage[]
}

type AnswerMap = Record<string, string>

type StatusMessage = {
  type: 'success' | 'error'
  text: string
}

const { pages: formPages } = pagesFile as FormPagesFile
const summaryStepIndex = formPages.length
const stepLabels = [...formPages.map((page) => page.title), 'Resumen']

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const makeFieldId = (pageIndex: number, question: string) =>
  `step-${pageIndex}-${slugify(question)}`

function App() {
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const isSummaryStep = currentStep === summaryStepIndex
  const progressPercent = (currentStep / (stepLabels.length - 1)) * 100

  const setSuccess = useCallback(
    (text: string) => setStatusMessage({ type: 'success', text }),
    [],
  )
  const setError = useCallback(
    (text: string) => setStatusMessage({ type: 'error', text }),
    [],
  )

  const handleInputChange = useCallback((fieldId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }))
  }, [])

  const goToStep = useCallback((stepIndex: number) => {
    setCurrentStep(Math.max(0, Math.min(stepIndex, summaryStepIndex)))
  }, [])

  const handleNext = () => {
    if (isSummaryStep) {
      handleExport()
      return
    }

    goToStep(currentStep + 1)
  }

  const handleBack = () => {
    goToStep(currentStep - 1)
  }

  const handleExport = () => {
    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        currentStep,
        answers,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'busup-canvas.json'
      link.click()
      URL.revokeObjectURL(url)
      setSuccess('Descargaste un archivo con toda la información.')
    } catch (error) {
      console.error(error)
      setError('No se pudo exportar el archivo.')
    }
  }

  const parseImport = useCallback(
    (text: string) => {
      const parsed = JSON.parse(text) as {
        answers?: Record<string, unknown>
        currentStep?: unknown
      }

      if (!parsed || typeof parsed !== 'object' || !parsed.answers) {
        throw new Error('El archivo no contiene respuestas.')
      }

      const sanitizedAnswers = Object.entries(parsed.answers).reduce<AnswerMap>(
        (acc, [key, value]) => {
          if (typeof value === 'string') {
            acc[key] = value
          }
          return acc
        },
        {},
      )

      const importedStep =
        typeof parsed.currentStep === 'number' && !Number.isNaN(parsed.currentStep)
          ? Math.max(0, Math.min(parsed.currentStep, summaryStepIndex))
          : 0

      setAnswers(sanitizedAnswers)
      goToStep(importedStep)
      setSuccess('Archivo importado correctamente.')
    },
    [goToStep, setSuccess],
  )

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) {
        return
      }

      try {
        const text = await files[0].text()
        parseImport(text)
      } catch (error) {
        console.error(error)
        setError('No reconocemos el archivo. Asegúrate de exportarlo desde la app.')
      }
    },
    [parseImport, setError],
  )

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files)
    event.target.value = ''
  }

  useEffect(() => {
    const handleDragOver = (event: DragEvent) => {
      const hasFiles = Array.from(event.dataTransfer?.types ?? []).includes('Files')
      if (!hasFiles) return

      event.preventDefault()
      event.dataTransfer!.dropEffect = 'copy'
      setDragActive(true)
    }

    const handleDragLeave = (event: DragEvent) => {
      if (event.relatedTarget === null) {
        setDragActive(false)
      }
    }

    const handleDrop = (event: DragEvent) => {
      const hasFiles = event.dataTransfer?.files && event.dataTransfer.files.length > 0
      if (!hasFiles) {
        setDragActive(false)
        return
      }
      event.preventDefault()
      setDragActive(false)
      void handleFiles(event.dataTransfer!.files)
    }

    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
    }
  }, [handleFiles])

  useEffect(() => {
    if (!statusMessage) {
      return
    }

    const timeout = setTimeout(() => setStatusMessage(null), 5000)
    return () => clearTimeout(timeout)
  }, [statusMessage])

  const currentPage = isSummaryStep ? null : formPages[currentStep]
  const primaryButtonLabel = isSummaryStep
    ? 'Descargar resumen'
    : currentStep === summaryStepIndex - 1
      ? 'Ver resumen'
      : 'Siguiente'

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Canvas sin fricción</p>
          <h1>Busup Venture Canvas</h1>
          <p className="subhead">
            Completa cada bloque, avanza con los botones o las migas y exporta un archivo
            listo para compartir.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="ghost-button" onClick={handleExport}>
            Exportar respuestas
          </button>
          <label className="ghost-button file-button">
            Cargar archivo
            <input type="file" accept="application/json" onChange={handleFileInput} />
          </label>
        </div>
      </header>

      <nav className="breadcrumbs" aria-label="Progreso del formulario">
        {stepLabels.map((label, index) => {
          const state =
            index === currentStep ? 'active' : index < currentStep ? 'complete' : 'pending'
          return (
            <button
              key={label}
              type="button"
              className={`breadcrumb ${state}`}
              onClick={() => goToStep(index)}
            >
              <span className="breadcrumb-index">{index + 1}</span>
              <span className="breadcrumb-label">{label}</span>
            </button>
          )
        })}
      </nav>

      <section className="content-card">
        {statusMessage && (
          <div className={`status-banner ${statusMessage.type}`}>{statusMessage.text}</div>
        )}

        {!isSummaryStep && currentPage ? (
          <>
            <header className="page-header">
              <p className="page-count">
                Paso {currentStep + 1} de {stepLabels.length}
              </p>
              <h2>{currentPage.title}</h2>
            </header>

            <form className="form-grid" onSubmit={(event) => event.preventDefault()}>
              {currentPage.items.map((item, itemIndex) => {
                const fieldId = makeFieldId(currentStep, item.question)
                const helpId = `${fieldId}-help`
                const answer = answers[fieldId] ?? ''
                return (
                  <label key={`${fieldId}-${itemIndex}`} className="form-field" htmlFor={fieldId}>
                    <div className="field-top">
                      <span className="area-pill">{item.area}</span>
                      <h3>{item.question}</h3>
                    </div>
                    <textarea
                      id={fieldId}
                      aria-describedby={helpId}
                      value={answer}
                      onChange={(event) => handleInputChange(fieldId, event.target.value)}
                      rows={item.help.length > 120 ? 6 : 4}
                      placeholder="Escribe tu respuesta..."
                    />
                    <small id={helpId}>{item.help}</small>
                  </label>
                )
              })}
            </form>
          </>
        ) : (
          <section className="summary">
            <header className="page-header">
              <p className="page-count">
                Paso {stepLabels.length} de {stepLabels.length}
              </p>
              <h2>Resumen general</h2>
              <p className="summary-hint">
                Revisa y descarga tus respuestas. Puedes regresar para editar cualquier bloque
                antes de exportar.
              </p>
            </header>
            <div className="summary-grid">
              {formPages.map((page, pageIndex) => (
                <article key={page.title} className="summary-block">
                  <h3>{page.title}</h3>
                  <dl>
                    {page.items.map((item) => {
                      const fieldId = makeFieldId(pageIndex, item.question)
                      const value = answers[fieldId]
                      return (
                        <div key={fieldId} className="summary-row">
                          <dt>
                            <span className="area-pill">{item.area}</span>
                            {item.question}
                          </dt>
                          <dd>{value?.trim() ? value : <span className="empty">Sin respuesta</span>}</dd>
                        </div>
                      )
                    })}
                  </dl>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>

      <footer className="nav-footer">
        <button
          type="button"
          className="ghost-button"
          onClick={handleBack}
          disabled={currentStep === 0}
        >
          Anterior
        </button>
        <div className="progress-track" aria-label="Progreso">
          <div className="progress-value" style={{ width: `${progressPercent}%` }} />
        </div>
        <button type="button" className="primary-button" onClick={handleNext}>
          {primaryButtonLabel}
        </button>
      </footer>

      {dragActive && (
        <div className="drop-overlay">
          <div>
            <p>Soltá el archivo exportado para cargar las respuestas.</p>
            <small>También podés usar el botón &quot;Cargar archivo&quot;.</small>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

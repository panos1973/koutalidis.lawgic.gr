import { getProject } from '@/lib/koutalidis/project-actions'
import { PRACTICE_AREAS, PRACTICE_TOOLS_BY_AREA, GENERAL_TOOLS } from '@/lib/koutalidis/practice-areas'
import { PracticeIcon } from '@/components/koutalidis/icons/PracticeIcons'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface PageProps {
  params: {
    locale: string
    projectId: string
  }
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { locale, projectId } = params
  const project = await getProject(projectId)

  if (!project) {
    notFound()
  }

  const projectAreas = (project.practiceAreas as string[]) || []

  return (
    <div className="flex-1 overflow-y-auto p-8">
      {/* Project header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">{project.name}</h1>
        {project.clientName && (
          <p className="text-sm text-gray-500 mt-1">{project.clientName}</p>
        )}
        {project.description && (
          <p className="text-sm text-gray-400 mt-2">{project.description}</p>
        )}
      </div>

      {/* Practice area tools */}
      {projectAreas.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
            Project Tools
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projectAreas.map((areaId) => {
              const area = PRACTICE_AREAS.find((a) => a.id === areaId)
              const tools = PRACTICE_TOOLS_BY_AREA[areaId]
              if (!area) return null

              return (
                <div
                  key={areaId}
                  className="border border-gray-200 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                    <PracticeIcon
                      iconName={area.icon}
                      size={16}
                      style={{ color: area.color }}
                    />
                    <h3
                      className="font-semibold text-sm"
                      style={{ color: area.color }}
                    >
                      {locale === 'el' ? area.nameEl : area.name}
                    </h3>
                  </div>

                  {tools ? (
                    <div className="space-y-3">
                      {Object.entries(tools).map(([category, categoryTools]) => (
                        <div key={category}>
                          <p className="text-[10px] uppercase text-gray-400 font-medium tracking-wider mb-1">
                            {category}
                          </p>
                          <div className="space-y-0.5">
                            {categoryTools.map((tool) => (
                              <Link
                                key={tool.id}
                                href={`/${locale}/projects/${projectId}/${tool.id}`}
                                className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                              >
                                <PracticeIcon
                                  iconName={tool.icon}
                                  size={12}
                                  className="text-gray-400"
                                />
                                {locale === 'el' ? tool.nameEl : tool.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Coming soon</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* General tools */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
          General Tools
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {GENERAL_TOOLS.map((tool) => (
            <Link
              key={tool.id}
              href={`/${locale}${tool.route}`}
              className="flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-lg
                         hover:border-gray-300 hover:shadow-sm transition-all text-sm text-gray-600
                         hover:text-gray-900"
            >
              <PracticeIcon
                iconName={tool.icon}
                size={18}
                className="text-gray-400"
              />
              {locale === 'el' ? tool.nameEl : tool.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

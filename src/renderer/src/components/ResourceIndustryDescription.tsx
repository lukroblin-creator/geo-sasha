import {
  getResourceIndustryDescription,
  getResourceIndustryOverview,
  type LocalizedResourceText,
  type ResourceIndustryFact
} from '../data/geography/resources'
import { useLanguage } from '../data/i18n'

function localized(text: LocalizedResourceText, language: 'fr' | 'en' | 'es'): string {
  return text[language] || text.fr
}

export function ResourceIndustryDescription({
  industry
}: {
  industry: ResourceIndustryFact
}): React.JSX.Element {
  const { language, t } = useLanguage()
  const research = industry.research
  const context = industry.industrialContext
  const researchSources = research?.sources ?? []
  const sources = [
    {
      name: 'CIA World Factbook — archived profile',
      url: 'https://github.com/factbook/factbook.json'
    },
    ...(context?.source ? [context.source] : []),
    ...(industry.sources ?? []),
    ...researchSources
  ].filter(
    (source, index, all) => all.findIndex((candidate) => candidate.url === source.url) === index
  )

  return (
    <div className="resource-industry-description">
      <p>
        {getResourceIndustryOverview(industry, language) ??
          t(getResourceIndustryDescription(industry.id))}
      </p>

      <section className="resource-industry-research-section">
        <h4>{t('Classement mondial vérifié')}</h4>
        {research?.worldRank ? (
          <div className="resource-industry-rank">
            <strong>
              #{research.worldRank.position}
              {research.worldRank.total ? ` / ${research.worldRank.total}` : ''}
            </strong>
            <span>
              {localized(research.worldRank.metric, language)} · {research.worldRank.year}
            </span>
            {research.worldRank.share && (
              <span>{localized(research.worldRank.share, language)}</span>
            )}
          </div>
        ) : (
          <p>ND</p>
        )}
      </section>

      <section className="resource-industry-research-section">
        <h4>{t('Poids dans le territoire')}</h4>
        <p>{research?.importance ? localized(research.importance, language) : 'ND'}</p>
      </section>

      <section className="resource-industry-research-section">
        <h4>{t('Production et savoir-faire')}</h4>
        <p>{research?.production ? localized(research.production, language) : 'ND'}</p>
      </section>

      <section className="resource-industry-research-section">
        <h4>{t('Travail et conditions')}</h4>
        <p>{research?.work ? localized(research.work, language) : 'ND'}</p>
      </section>

      <section className="resource-industry-research-section resource-industry-national-context">
        <h4>{t('Contexte industriel national')}</h4>
        {context ? (
          <>
            {context.manufacturingRank && (
              <p>
                <strong>
                  {t('Compétitivité manufacturière')} : #{context.manufacturingRank.position} /{' '}
                  {context.manufacturingRank.total}
                </strong>
                <span>
                  {' '}
                  · {context.manufacturingRank.year} ·{' '}
                  {t('Rang général du pays, pas un classement de ce secteur.')}
                </span>
              </p>
            )}
            {context.indicators?.map((indicator) => (
              <p
                className="resource-industry-context-indicator"
                key={`${indicator.label.fr}-${indicator.year}`}
              >
                <span>{localized(indicator.label, language)}</span>
                <strong>
                  {typeof indicator.value === 'string'
                    ? indicator.value
                    : localized(indicator.value, language)}
                </strong>
                <small>{indicator.year}</small>
              </p>
            ))}
          </>
        ) : (
          <p>ND</p>
        )}
      </section>

      {industry.sourceDetails && (
        <div className="resource-industry-source-details">
          <span>{t('Activités détaillées mentionnées dans la source (termes originaux)')}</span>
          <p>{industry.sourceDetails}</p>
        </div>
      )}

      {sources.length > 0 && (
        <div className="resource-industry-sources">
          <h4>{t('Sources')}</h4>
          <ul>
            {sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {t(source.name)}
                  {source.year ? ` · ${source.year}` : ''}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

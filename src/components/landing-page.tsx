import Link from "next/link";

const painPoints = [
  {
    title: "Видна выручка, но не видно реальную прибыль",
    description: "Отчеты показывают оборот, но не отвечают, сколько денег остается после комиссий, логистики, рекламы и себестоимости."
  },
  {
    title: "Непонятно, какие SKU уже убыточны",
    description: "Проблемные позиции растворяются в общей массе каталога и замечаются только после просадки по кассе."
  },
  {
    title: "Нет прямого ответа, что делать сегодня",
    description: "Команда смотрит в десятки цифр, но не получает короткий список действий на день."
  },
  {
    title: "Кассовый разрыв замечают слишком поздно",
    description: "Риск проявляется уже тогда, когда закупка, реклама и обязательства начинают конкурировать за один и тот же остаток."
  }
] as const;

const valueCards = [
  {
    title: "Зарабатываешь ли ты сегодня",
    description: "Сервис сводит выручку, расходы и фактический вклад в прибыль в один дневной итог.",
    outcome: "Понимаете состояние бизнеса не по обороту, а по деньгам."
  },
  {
    title: "Какие SKU тянут прибыль вниз",
    description: "MarginPoint показывает убыточные и хрупкие позиции, где маржа уже ушла в минус или почти исчезла.",
    outcome: "Быстрее находите SKU, которые нужно разбирать первыми."
  },
  {
    title: "Есть ли риск по кассе на ближайшие дни",
    description: "Отдельный контур для прогноза остатка, обязательств и точки, где может появиться кассовый разрыв.",
    outcome: "Раньше принимаете решения по закупке, рекламе и выплатам."
  }
] as const;

const featureCards = [
  {
    eyebrow: "Дневной ритм",
    icon: "focus",
    title: "Что важно сегодня",
    description: "Короткий список приоритетов и алертов на день.",
    hint: "Сначала смотрите сюда."
  },
  {
    eyebrow: "SKU-контур",
    icon: "sku",
    title: "Проблемные SKU",
    description: "Показывает убыточные и рискованные позиции с понятной причиной просадки.",
    hint: "Цена, реклама, комиссия, затраты."
  },
  {
    eyebrow: "Разбор позиции",
    icon: "card",
    title: "Карточка SKU",
    description: "Объясняет, почему маржа слабая и что именно стоит проверить.",
    hint: "Один SKU, один понятный вывод."
  },
  {
    eyebrow: "Порог рентабельности",
    icon: "calculator",
    title: "Калькулятор юнит-экономики",
    description: "Считает безубыточную цену, предел рекламы и критические расходы.",
    hint: "Для цены, акции и рекламы."
  },
  {
    eyebrow: "Контроль кассы",
    icon: "cash",
    title: "Кассовый прогноз",
    description: "Показывает минимальный остаток и дни, где нужна осторожность.",
    hint: "Горизонт ближайших недель."
  },
  {
    eyebrow: "Для созвона",
    icon: "brief",
    title: "Короткий бриф",
    description: "Собирает итог дня и приоритеты в одну страницу.",
    hint: "Для собственника и команды."
  }
] as const;

const personas = [
  {
    title: "Собственнику",
    description: "Быстро понять, где уходит прибыль и какие решения нельзя откладывать до конца недели."
  },
  {
    title: "Операционному менеджеру",
    description: "Видеть, что проверить сегодня в первую очередь по SKU, рекламе, цене и обязательствам."
  },
  {
    title: "Команде marketplace",
    description: "Быстрее разбирать позиции, согласовывать действия и работать от приоритетов, а не от хаотичных отчетов."
  }
] as const;

const comparisonCards = [
  {
    title: "Не просто цифры",
    description: "А интерпретация: где именно теряется прибыль и почему это происходит."
  },
  {
    title: "Не просто отчет",
    description: "А список приоритетов на день, который можно отдать собственнику или менеджеру."
  },
  {
    title: "Не просто прибыль",
    description: "А единый контур: SKU, юнит-экономика, касса и ближайшие риски."
  },
  {
    title: "Не просто BI",
    description: "А ежедневный рабочий инструмент для решений, а не для наблюдения."
  }
] as const;

const credibilityCards = [
  "Для первых пилотов с продавцами маркетплейсов, где критична именно ежедневная экономика по SKU.",
  "Собрано вокруг решений по прибыли, а не вокруг еще одного перегруженного dashboard.",
  "Основано на логике unit-экономики, SKU-анализа и кассового контроля, которые нужны в операционном ритме."
] as const;

const faqs = [
  {
    question: "Для каких маркетплейсов подходит продукт?",
    answer:
      "Текущий пилот сфокусирован на WB. Логика продукта изначально собирается для marketplace-команд, чтобы затем добавить следующие контуры без смены подхода к прибыли, SKU и кассе."
  },
  {
    question: "Это только дашборд или сервис дает рекомендации?",
    answer:
      "Смысл MarginPoint не в наборе графиков. Сервис сводит данные в короткий дневной вывод: где риск, какие SKU нужно разбирать и что стоит сделать первым."
  },
  {
    question: "Что именно показывает по SKU?",
    answer:
      "Маржу, вклад в прибыль, признаки убыточности, неполные затраты и причины, из-за которых SKU проседает: цена, комиссия, логистика, реклама или себестоимость."
  },
  {
    question: "Можно ли увидеть риск кассового разрыва?",
    answer:
      "Да, отдельный блок показывает прогноз остатка, напряженные дни и вероятность кассового разрыва на ближайшем горизонте."
  },
  {
    question: "Нужна ли сложная настройка?",
    answer:
      "Нет. Для пилота важнее быстро собрать рабочий контур данных и показать, какие решения можно принимать уже в первый день."
  },
  {
    question: "Это для собственника или для команды?",
    answer:
      "И для собственника, и для команды. Собственник получает короткий итог по прибыли и кассе, а команда понимает, какие SKU и расходы разбирать в первую очередь."
  }
] as const;

function SectionHeader({
  eyebrow,
  title,
  description,
  tone = "default"
}: {
  eyebrow: string;
  title: string;
  description: string;
  tone?: "default" | "light";
}) {
  return (
    <div className={`landing-section-header${tone === "light" ? " landing-section-header--light" : ""}`}>
      <span className="landing-section-header__eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function FeatureIcon({ icon }: { icon: (typeof featureCards)[number]["icon"] }) {
  if (icon === "focus") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 4v3m0 10v3M4 12h3m10 0h3" />
        <circle cx="12" cy="12" r="4.5" />
      </svg>
    );
  }

  if (icon === "sku") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M5 7.5h14M5 12h10M5 16.5h7" />
        <circle cx="18" cy="16.5" r="2.5" />
      </svg>
    );
  }

  if (icon === "card") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect x="5" y="5" width="14" height="14" rx="3" />
        <path d="M9 10.5h6M9 14h4" />
      </svg>
    );
  }

  if (icon === "calculator") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect x="6" y="4.5" width="12" height="15" rx="3" />
        <path d="M9 8.5h6M9.5 12.5h.01M12 12.5h.01M14.5 12.5h.01M9.5 15.5h.01M12 15.5h.01M14.5 15.5h.01" />
      </svg>
    );
  }

  if (icon === "cash") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4.5 16.5V10a2 2 0 0 1 2-2h11" />
        <path d="M8 19.5h9.5a2 2 0 0 0 2-2v-7H10a2 2 0 0 0-2 2v7Z" />
        <circle cx="15" cy="15" r="1.75" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6 7.5h12M6 12h12M6 16.5h8" />
      <path d="M17 6.5 19.5 9l-2.5 2.5" />
    </svg>
  );
}

export function LandingPage() {
  return (
    <main className="landing-page">
      <section className="landing-hero-shell">
        <div className="landing-container">
          <header className="landing-header">
            <Link className="landing-brand" href="/">
              <span className="landing-brand__mark">MP</span>
              <span>
                MarginPoint
                <small>Точка маржи</small>
              </span>
            </Link>

            <nav className="landing-nav" aria-label="Основная навигация">
              <a href="#how-it-works">Как это работает</a>
              <a href="#capabilities">Возможности</a>
              <a href="#audience">Для кого</a>
              <a href="#screenshots">Скриншоты</a>
              <a href="#faq">FAQ</a>
            </nav>

            <a className="button button--primary landing-header__cta" href="#demo">
              Получить демо
            </a>
          </header>

          <div className="landing-hero">
            <div className="landing-hero__content">
              <span className="landing-kicker">DAILY PROFIT ASSISTANT FOR MARKETPLACE SELLERS</span>
              <h1>ГДЕ ТЕРЯЕТСЯ ПРИБЫЛЬ И ЧТО ДЕЛАТЬ СЕГОДНЯ</h1>
              <p className="landing-hero__lead">
                MarginPoint показывает реальную прибыль, проблемные SKU, дневные приоритеты и риск кассового разрыва без перегруженных BI-отчетов.
              </p>

              <div className="landing-button-row">
                <a className="button button--primary" href="#demo">
                  Получить демо
                </a>
                <a className="button button--ghost landing-button--dark" href="#screenshots">
                  Посмотреть интерфейс
                </a>
              </div>

              <div className="landing-trust-row">
                <span>Первый пилот: WB</span>
                <span>Ежедневный бриф по прибыли, SKU и кассе</span>
                <span>Решения, а не просто цифры</span>
              </div>
            </div>

            <div className="landing-hero__visual">
              <div className="landing-dashboard">
                <div className="landing-dashboard__chrome">
                  <span />
                  <span />
                  <span />
                </div>

                <div className="landing-dashboard__header">
                  <div>
                    <strong>Сегодня</strong>
                    <p>Дневной итог по прибыли, SKU и кассе</p>
                  </div>
                  <span className="landing-pill">Обновлено 09:20</span>
                </div>

                <div className="landing-dashboard__stats">
                  <article>
                    <span>Вклад в прибыль</span>
                    <strong>+184 300 ₽</strong>
                    <small>после комиссий, логистики и себестоимости</small>
                  </article>
                  <article>
                    <span>SKU под разбор</span>
                    <strong>11</strong>
                    <small>3 уже в минусе, 8 на грани</small>
                  </article>
                  <article>
                    <span>Кассовый риск</span>
                    <strong>Под наблюдением</strong>
                    <small>проверьте ближайшие 6 дней</small>
                  </article>
                </div>

                <div className="landing-dashboard__grid">
                  <article className="landing-dashboard-card landing-dashboard-card--accent">
                    <span>Что важно сегодня</span>
                    <strong>Сначала разберите 3 SKU с отрицательной маржей и сократите рекламу там, где вклад уже ушел в минус.</strong>
                    <ul>
                      <li>Цена не покрывает логистику по двум позициям</li>
                      <li>Одна SKU просела из-за рекламы выше порога</li>
                    </ul>
                  </article>

                  <article className="landing-dashboard-card">
                    <span>Где уходит маржа</span>
                    <div className="landing-mini-table">
                      <div>
                        <strong>SKU 287413</strong>
                        <small>Маржа -7.4%</small>
                      </div>
                      <div>
                        <strong>SKU 117204</strong>
                        <small>Реклама выше порога</small>
                      </div>
                      <div>
                        <strong>SKU 014882</strong>
                        <small>Не заполнены все затраты</small>
                      </div>
                    </div>
                  </article>

                  <article className="landing-dashboard-card">
                    <span>Касса 14 дней</span>
                    <div className="landing-cash-bars" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i className="is-alert" />
                      <i className="is-alert" />
                      <i />
                      <i />
                    </div>
                    <small>Минимальный остаток через 6 дней: 241 000 ₽</small>
                  </article>
                </div>
              </div>

              <article className="landing-floating-card landing-floating-card--left">
                <span>Проблемная SKU</span>
                <strong>Маржа почти исчезла</strong>
                <p>Цена выросла медленнее, чем комиссия + логистика + реклама.</p>
              </article>

              <article className="landing-floating-card landing-floating-card--right">
                <span>Короткий бриф</span>
                <strong>Три решения на день</strong>
                <p>Собственник и команда видят один и тот же приоритетный список действий.</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-marquee" aria-label="Ключевые термины продукта">
        <div className="landing-marquee__track">
          <span>ПРИБЫЛЬ · SKU · КАССА · ЮНИТ-ЭКОНОМИКА · WB · ЕЖЕДНЕВНЫЙ БРИФ · ПРИОРИТЕТЫ · </span>
          <span>ПРИБЫЛЬ · SKU · КАССА · ЮНИТ-ЭКОНОМИКА · WB · ЕЖЕДНЕВНЫЙ БРИФ · ПРИОРИТЕТЫ · </span>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-container">
          <SectionHeader
            eyebrow="Проблема"
            title="Почему обычные отчеты не помогают быстро принять решение"
            description="Отчетов много, а ясного ответа мало. Пока команда разбирает таблицы, прибыль уже утекает через SKU, рекламу и кассу."
          />

          <div className="landing-grid landing-grid--4">
            {painPoints.map((item) => (
              <article className="landing-card" key={item.title}>
                <span className="landing-card__number">0{painPoints.indexOf(item) + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--muted">
        <div className="landing-container">
          <SectionHeader
            eyebrow="Что делает MarginPoint"
            title="Один экран, три главных ответа на день"
            description="Сервис не заставляет читать десятки графиков. Он сводит день в понятный управленческий контур: прибыль, SKU и касса."
          />

          <div className="landing-grid landing-grid--3">
            {valueCards.map((item) => (
              <article className="landing-card landing-card--feature" key={item.title}>
                <span className="landing-chip">Ежедневный ответ</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <strong>{item.outcome}</strong>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section" id="capabilities">
        <div className="landing-container">
          <SectionHeader
            eyebrow="Возможности"
            title="Продуктовые блоки, которые работают на ежедневные решения"
            description="Каждый экран заточен под конкретный управленческий вопрос, а не под красивую витрину данных."
          />

          <div className="landing-grid landing-grid--3">
            {featureCards.map((item) => (
              <article className="landing-card landing-card--capability" key={item.title}>
                <div className="landing-card__icon">
                  <FeatureIcon icon={item.icon} />
                </div>
                <span className="landing-card__eyebrow">{item.eyebrow}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <strong className="landing-card__hint">{item.hint}</strong>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--dark" id="how-it-works">
        <div className="landing-container">
          <SectionHeader
            eyebrow="Как это работает"
            title="Короткий путь от данных к приоритету на день"
            description="Без сложного внедрения и длинной цепочки согласований. Важно быстро увидеть, где именно теряются деньги."
            tone="light"
          />

          <div className="landing-steps">
            <article className="landing-step">
              <span>01</span>
              <h3>Подключаете или загружаете данные</h3>
              <p>Сервис собирает базу для расчета прибыли, маржи и кассового контура без лишней операционной рутины.</p>
            </article>
            <article className="landing-step">
              <span>02</span>
              <h3>MarginPoint считает риски и приоритеты</h3>
              <p>SKU, юнит-экономика, касса и дневные сигналы собираются в один рабочий вывод.</p>
            </article>
            <article className="landing-step">
              <span>03</span>
              <h3>Каждый день видите, что делать первым</h3>
              <p>Команда быстрее понимает, где теряется прибыль и какие действия дают эффект уже сегодня.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-section" id="screenshots">
        <div className="landing-container">
          <SectionHeader
            eyebrow="Скриншоты"
            title="Реальный продуктовый контур, а не набор абстрактных карточек"
            description="Ниже показаны ключевые экраны, на которых строится ежедневная работа с прибылью, SKU и кассой."
          />

          <div className="landing-shots">
            <article className="landing-shot landing-shot--wide">
              <div className="landing-shot__copy">
                <span className="landing-chip">Сегодня</span>
                <h3>Дневной итог</h3>
                <p>Короткая сводка: где прибыль, какие SKU проваливаются и нужно ли срочно смотреть кассу.</p>
              </div>
              <div className="landing-shot__frame">
                <div className="landing-shot__stats">
                  <article>
                    <span>Прибыль</span>
                    <strong>+184 300 ₽</strong>
                  </article>
                  <article>
                    <span>SKU в риске</span>
                    <strong>11</strong>
                  </article>
                  <article>
                    <span>Касса</span>
                    <strong>Watch</strong>
                  </article>
                </div>
                <div className="landing-shot__summary">
                  <strong>Сегодня первым делом:</strong>
                  <p>снять 2 SKU из агрессивной рекламы, проверить цену на 3 убыточных позиции и подтвердить обязательства на ближайшую неделю.</p>
                </div>
              </div>
            </article>

            <div className="landing-shot-grid">
              <article className="landing-shot">
                <div className="landing-shot__copy">
                  <span className="landing-chip">SKU</span>
                  <h3>Проблемные позиции</h3>
                </div>
                <div className="landing-shot__frame landing-shot__frame--table">
                  <div>
                    <strong>SKU 287413</strong>
                    <small>-7.4% маржи</small>
                  </div>
                  <div>
                    <strong>SKU 117204</strong>
                    <small>реклама выше порога</small>
                  </div>
                  <div>
                    <strong>SKU 014882</strong>
                    <small>неполные затраты</small>
                  </div>
                </div>
              </article>

              <article className="landing-shot">
                <div className="landing-shot__copy">
                  <span className="landing-chip">Касса</span>
                  <h3>Прогноз остатка</h3>
                </div>
                <div className="landing-shot__frame landing-shot__frame--bars">
                  <i />
                  <i />
                  <i className="is-alert" />
                  <i className="is-alert" />
                  <i />
                  <i />
                </div>
              </article>

              <article className="landing-shot">
                <div className="landing-shot__copy">
                  <span className="landing-chip">Калькулятор</span>
                  <h3>Юнит-экономика</h3>
                </div>
                <div className="landing-shot__frame">
                  <div className="landing-shot__metric">
                    <span>Безубыточная цена</span>
                    <strong>1 940 ₽</strong>
                  </div>
                  <div className="landing-shot__metric">
                    <span>Порог рекламы</span>
                    <strong>12%</strong>
                  </div>
                </div>
              </article>

              <article className="landing-shot">
                <div className="landing-shot__copy">
                  <span className="landing-chip">Бриф</span>
                  <h3>Одна страница для созвона</h3>
                </div>
                <div className="landing-shot__frame">
                  <div className="landing-shot__summary">
                    <strong>3 решения на день</strong>
                    <p>Итог по прибыли, кассовому риску и SKU, которые нельзя откладывать.</p>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--muted" id="audience">
        <div className="landing-container">
          <SectionHeader
            eyebrow="Для кого"
            title="Кому подойдет MarginPoint"
            description="Продукт сделан для тех, кому нужно быстро принимать ежедневные решения по прибыли, а не пересказывать отчетность."
          />

          <div className="landing-grid landing-grid--3">
            {personas.map((item) => (
              <article className="landing-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-container">
          <SectionHeader
            eyebrow="Отличие"
            title="Чем это отличается от обычной аналитики"
            description="MarginPoint помогает принять решение в операционном ритме, а не просто складывает показатели в еще один dashboard."
          />

          <div className="landing-grid landing-grid--4">
            {comparisonCards.map((item) => (
              <article className="landing-card landing-card--contrast" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--soft-dark">
        <div className="landing-container">
          <SectionHeader
            eyebrow="Почему можно доверять"
            title="Мягкий credibility-блок для первых пилотов"
            description="Без вымышленных кейсов и декоративных логотипов. Только то, на чем реально держится ценность продукта."
            tone="light"
          />

          <div className="landing-grid landing-grid--3">
            {credibilityCards.map((item) => (
              <article className="landing-card landing-card--dark" key={item}>
                <p>{item}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--cta" id="demo">
        <div className="landing-container">
          <div className="landing-cta">
            <div className="landing-cta__content">
              <span className="landing-kicker">Пилот и демо</span>
              <h2>Посмотри, где у тебя уходит маржа</h2>
              <p>
                Открой демо-пространство или получи доступ по email. MarginPoint покажет, какие SKU тянут вниз прибыль, где риск по кассе и что делать сегодня первым.
              </p>
              <div className="landing-button-row">
                <Link className="button button--secondary" href="/auth/demo">
                  Открыть демо-пространство
                </Link>
                <Link className="button button--ghost landing-button--dark" href="/auth">
                  Рабочий вход
                </Link>
              </div>
            </div>

            <form action="/auth/login" className="landing-demo-form" method="post">
              <label htmlFor="landing-email">Email для доступа</label>
              <input id="landing-email" name="email" placeholder="owner@company.ru" type="email" />
              <button className="button button--primary" type="submit">
                Получить демо
              </button>
              <p>Форма использует реальный текущий сценарий входа: email создает или открывает рабочее пространство без лишних шагов.</p>
            </form>
          </div>
        </div>
      </section>

      <section className="landing-section" id="faq">
        <div className="landing-container">
          <SectionHeader
            eyebrow="FAQ"
            title="Частые вопросы"
            description="Коротко и по делу о текущем пилоте, рабочих сценариях и том, как использовать продукт ежедневно."
          />

          <div className="landing-faq">
            {faqs.map((item) => (
              <details className="landing-faq__item" key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container landing-footer__inner">
          <div>
            <Link className="landing-brand landing-brand--footer" href="/">
              <span className="landing-brand__mark">MP</span>
              <span>
                MarginPoint
                <small>Ежедневный ассистент по прибыли, SKU и кассе</small>
              </span>
            </Link>
          </div>

          <div className="landing-footer__links">
            <a href="#how-it-works">Как это работает</a>
            <a href="#capabilities">Возможности</a>
            <a href="#screenshots">Скриншоты</a>
            <a href="#faq">FAQ</a>
          </div>

          <div className="landing-footer__actions">
            <Link href="/auth">Получить доступ</Link>
            <Link href="/auth/demo">Открыть демо</Link>
            <p>Пилотные запросы и демо сейчас открываются через рабочее и демо-пространство внутри продукта.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}

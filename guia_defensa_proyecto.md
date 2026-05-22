# 🛡️ Guía para la Defensa del Proyecto: Dashboard de KPIs Financieros y Riesgo

Este documento detalla exhaustivamente cómo se construyeron los indicadores (KPIs), la arquitectura detrás de la solución y los puntos clave que debes mencionar durante la defensa de tu proyecto. 

---

## 🏛️ 1. Arquitectura General del Sistema

El proyecto está diseñado bajo un modelo Cliente-Servidor (Frontend y Backend separados) lo cual garantiza escalabilidad y mantenibilidad.

*   **Backend (NestJS + TypeORM):** Es el cerebro de los datos. Expone una API REST (documentada con Swagger). El backend se conecta a una base de datos PostgreSQL y realiza todas las **agrupaciones, cálculos lógicos y uniones (JOINs)** desde el lado del servidor usando SQL puro y Query Builder, lo que asegura que el Frontend solo reciba lo que necesita.
*   **Frontend (React + Vite + TailwindCSS):** Consume la API usando `axios`. Los dashboards se pintan de manera dinámica utilizando la librería `recharts` para las gráficas y componentes UI modernos.
*   **Modelo de Datos (Sábanas):** La lógica gira entorno a "Sábanas" de datos (`sabana_credito` y `sabana_ahorro`), que representan *snapshots* o fotografías históricas (ej. cortes semanales o mensuales) del estado real de los clientes de la cooperativa.

> **Punto para la defensa:** Destaca que el cálculo de los KPIs pesados se realiza en el **Backend / Base de Datos** a través de subconsultas SQL (`WITH ... AS ()`). Esto es una excelente práctica porque evita sobrecargar la memoria del Frontend y del navegador del cliente, haciendo que la aplicación sea extremadamente rápida incluso si hay cientos de miles de registros en la base de datos.

---

## 📊 2. Lógica Matemática y Estadística por Módulo

El sistema cuenta con 4 módulos principales de analítica. Aquí está la explicación técnica de cómo se calcula cada uno:

### A. Alerta Temprana de Cuotas en Riesgo
**Objetivo:** Prevenir la morosidad actuando antes de que el socio incumpla su fecha de pago.
*   **Tabla origen:** `sabana_credito`.
*   **Filtros principales:** `estado_op = 'VIGENTE'` (Solo créditos activos).
*   **Cálculo Clave:** Se toma la fecha del servidor o fecha actual (`NOW()`) y se compara con la `fecha_prox_pago` del crédito usando `EXTRACT(DAY FROM (fecha_prox_pago - NOW()))`.
*   **Segmentación del Riesgo:**
    *   **Riesgo Crítico:** Socios que deben pagar en los próximos **0 a 7 días**.
    *   **Riesgo Alto:** Socios que deben pagar entre **8 y 15 días**.
    *   **Riesgo Moderado:** Socios que deben pagar entre **16 y 30 días**.

### B. Concentración de la Cartera
**Objetivo:** Analizar en qué sectores, ciudades o destinos está concentrado el dinero de la cooperativa para mitigar el riesgo sistémico (no poner todos los huevos en la misma canasta).
*   **Tabla origen:** `sabana_credito`.
*   **Lógica SQL:** Se utiliza agrupamiento (`GROUP BY`) por tres dimensiones principales: `actividad_socio`, `destino_op` y `ciudad_orig`.
*   **Filtro:** Siempre se consulta el *último corte disponible* de la base de datos (`WHERE qy_fechaproc = MAX(qy_fechaproc)`).
*   **KPIs:**
    *   **Índice de Mora Sectorial:** Se suma el total del `saldo_capital` de todas las operaciones, y se suma aparte el `saldo_mora` (solo de aquellos con `dias_mora > 0`). El índice de mora = `(Capital en Mora / Capital Total) * 100`.

### C. Retención de Socios (Riesgo de Fuga / Liquidez)
**Objetivo:** Detectar qué cuentas de ahorro están abandonadas o inactivas para accionar campañas de reactivación antes de que el socio retire su liquidez total o cierre la cuenta.
*   **Tablas origen:** `sabana_ahorro` (para inactividad) unida a `sabana_credito` (para saber si el socio tiene vínculos activos).
*   **Cálculo de Inactividad:** Se resta la fecha de última transacción (`fecha_ultmov`) a la fecha actual (`NOW()`) para obtener los **días de inactividad**.
*   **Probabilidad de Fuga:**
    *   Se utiliza un modelo empírico y lineal: `LEAST(100, dias_inactividad * 0.5)`. Esto significa que cada 2 días de inactividad aumentan un 1% la probabilidad de fuga del socio, con un límite máximo estadístico del 100%.
*   **Niveles de Riesgo:**
    *   **Riesgo Alto:** Inactividad mayor a 90 días.
    *   **Riesgo Medio:** Inactividad entre 30 y 90 días.
    *   **Riesgo Bajo:** Menos de 30 días.
*   **Nota Técnica de BD:** Para relacionar ambas tablas correctamente sin que falle la consulta, se hace un casteo explícito `CAST(v_ah_cliente AS TEXT)` ya que en la BD el ahorro guardaba el ID como número (double precision) y el crédito como texto, mitigando errores de tipo entre tablas (`operator does not exist`).

### D. Recuperabilidad de Cartera Vencida
**Objetivo:** Clasificar a los socios que ya están en mora para que el equipo de cobranzas sepa a quién llamar primero y recuperar el mayor capital posible.
*   **Tabla origen:** `sabana_credito`.
*   **Filtros principales:** `estado_op = 'VIGENTE'` Y `dias_mora > 0` (Exclusivamente cartera dañada).
*   **Score de Recuperación (KPI):**
    *   Fórmula: `100 - LEAST(90, dias_mora * 0.5)`.
    *   *Significado:* Mientras más días en mora tiene un crédito, **más difícil es recuperar el dinero**. El score arranca en 100 (facilidad máxima de cobro) y va restando puntaje conforme avanzan los días de mora.
*   **Segmentación Estratégica:**
    *   **Alta (Recuperación rápida):** Menos de 30 días de mora (suele ser olvido).
    *   **Media (Cobranza extrajudicial):** De 30 a 90 días de mora.
    *   **Baja (Cobranza legal/Dudoso recaudo):** Más de 90 días.

---

## 💡 3. Respuestas a Posibles Preguntas del Jurado

**Q1: ¿Por qué usaron un modelo basado en "Sábanas" y no consultan directamente el sistema transaccional (core bancario)?**
*Respuesta:* Al tratarse de un Dashboard analítico e inteligencia de negocios, si consultamos la base transaccional en tiempo real ralentizaríamos el sistema operativo de la cooperativa. Usar "sábanas" (Data Warehousing o snapshots de cortes) permite realizar queries complejas, cruces y agrupaciones masivas sin afectar el rendimiento de la entidad.

**Q2: ¿Cómo garantizan que la información que muestran las gráficas sea fidedigna?**
*Respuesta:* Toda la agregación de datos (`SUM`, `COUNT`, `GROUP BY`) se realiza a nivel del motor de PostgreSQL en el backend de NestJS mediante "Common Table Expressions" (bloques `WITH`). El frontend no altera la información matemática, simplemente recibe un DTO (Data Transfer Object) estrictamente tipado y lo proyecta visualmente. Si las sábanas de origen están íntegras, el Dashboard reflejará los totales perfectos.

**Q3: ¿Qué pasaría si la cooperativa aumenta de 10,000 a 500,000 clientes? ¿Soporta la carga el aplicativo web?**
*Respuesta:* Sí, la arquitectura es completamente escalable por dos razones:
1. Usamos **páginación a nivel de SQL** (`LIMIT` y `OFFSET`) en todas las tablas para enviar la data por bloques al usuario y no saturar la red.
2. Hemos definido **Índices a nivel de base de datos** (visibles en las entidades TypeORM) en columnas clave como el ID de cliente, fecha de proceso y calificación de riesgo, acelerando los tiempos de respuesta del motor SQL.

**Q4: ¿Cómo definieron la fórmula de "Probabilidad de Fuga" o "Score de Recuperación"?**
*Respuesta:* Se establecieron métricas paramétricas basadas en los principios de riesgo de la economía popular y solidaria. En la recuperación, se considera que después de los 90 días la deuda entra en estado crítico legal (cartera castigada o irrecuperable), de ahí la penalización acelerada en el score. Para las cuentas de ahorro inactivas, el riesgo sube progresivamente conforme la cuenta está inactiva y no tiene vínculos de crédito.

---

## 🎯 4. Conclusión para el Cierre de la Defensa
El valor principal de este proyecto tecnológico no es solo crear gráficas modernas; **es transformar datos crudos del banco en conocimiento útil, preventivo y accionable**. 

Con este panel, un gerente o analista no tiene que revisar miles de líneas de Excel para saber qué va mal, sino que el sistema filtra automáticamente qué créditos son los más peligrosos HOY, en qué ciudad se acumula el mayor riesgo de mora, y qué clientes están a punto de abandonar la cooperativa con su liquidez. Es una herramienta de optimización y prevención financiera.

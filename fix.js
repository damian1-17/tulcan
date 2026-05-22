const fs = require('fs');
let content = fs.readFileSync('src/modules/dashboard/dashboard.service.ts', 'utf8');

const regex = /  async getConcentracionCartera\(\)[\s\S]*?\} catch \(error\) \{\s*this\.logger\.error\('Error en getConcentracionCartera', error\);\s*throw error;\s*\}\s*\}/;
const match = content.match(regex);

if (match) {
  const index = match.index + match[0].length;
  let newContent = content.substring(0, index) + '\n';
  
  newContent += `
  // ─────────────────────────────────────────────────────────────────────────────
  // Retención de Socios (Riesgo de Fuga)
  // ─────────────────────────────────────────────────────────────────────────────
  async getRetencionSocios(page: number, limit: number, riesgo?: string): Promise<RetencionResponseDto> {
    try {
      const offset = (page - 1) * limit;

      const baseSql = \`
        WITH max_ahorro AS (
          SELECT MAX(fecha_proceso) AS fecha FROM sabana_ahorro
        ),
        base_ahorro AS (
          SELECT
            v_ah_cliente AS nro_cliente,
            v_ah_nombre AS nombres_socio,
            CAST(saldo_disponible AS FLOAT) AS saldo_ahorro,
            COALESCE(CAST(EXTRACT(DAY FROM (NOW() - fecha_ultmov)) AS INT), 0) AS dias_inactividad,
            fecha_ultmov AS fecha_ult_movimiento
          FROM sabana_ahorro
          WHERE fecha_proceso = (SELECT fecha FROM max_ahorro)
        ),
        base_credito AS (
          SELECT DISTINCT nro_cliente FROM sabana_credito WHERE estado_op = 'VIGENTE'
        ),
        resultado AS (
          SELECT
            a.nro_cliente,
            a.nombres_socio,
            a.saldo_ahorro,
            a.dias_inactividad,
            a.fecha_ult_movimiento,
            CASE WHEN c.nro_cliente IS NOT NULL THEN true ELSE false END AS tiene_credito,
            false AS tiene_cooplinea,
            LEAST(100, CAST(a.dias_inactividad AS FLOAT) * 0.5) AS probabilidad_fuga,
            CASE
              WHEN a.dias_inactividad > 90 THEN 'Alto'
              WHEN a.dias_inactividad > 30 THEN 'Medio'
              ELSE 'Bajo'
            END AS nivel_riesgo,
            'Inactividad prolongada' AS motivo_principal
          FROM base_ahorro a
          LEFT JOIN base_credito c ON a.nro_cliente = c.nro_cliente
        )
      \`;

      let filtro = '';
      if (riesgo) {
        filtro = \`WHERE nivel_riesgo = '\${riesgo}'\`;
      }

      const sql = \`
        \${baseSql}
        SELECT * FROM resultado
        \${filtro}
        ORDER BY probabilidad_fuga DESC
        LIMIT $1 OFFSET $2;
      \`;

      const sqlResumen = \`
        \${baseSql}
        SELECT
          COUNT(*) FILTER (WHERE nivel_riesgo = 'Alto') AS total_riesgo_alto,
          COUNT(*) FILTER (WHERE nivel_riesgo = 'Medio') AS total_riesgo_medio,
          SUM(saldo_ahorro) FILTER (WHERE nivel_riesgo IN ('Alto', 'Medio')) AS saldo_en_riesgo,
          COUNT(*) AS total
        FROM resultado
        \${filtro};
      \`;

      const [rows, [res]] = await Promise.all([
        this.sabanaAhorroRepo.query(sql, [limit, offset]),
        this.sabanaAhorroRepo.query(sqlResumen),
      ]);

      const data = rows.map((r: any) => ({
        nroCliente: String(r.nro_cliente),
        nombresSocio: r.nombres_socio,
        saldoAhorro: parseFloat(r.saldo_ahorro || 0),
        diasInactividad: parseInt(r.dias_inactividad || 0, 10),
        fechaUltMovimiento: r.fecha_ult_movimiento ? String(r.fecha_ult_movimiento) : null,
        tieneCredito: r.tiene_credito,
        tieneCooplinea: r.tiene_cooplinea,
        probabilidadFuga: parseFloat(r.probabilidad_fuga || 0),
        nivelRiesgo: r.nivel_riesgo,
        motivoPrincipal: r.motivo_principal,
      }));

      const resumen = {
        totalRiesgoAlto: parseInt(res?.total_riesgo_alto || '0', 10),
        totalRiesgoMedio: parseInt(res?.total_riesgo_medio || '0', 10),
        saldoEnRiesgo: parseFloat(res?.saldo_en_riesgo || '0'),
      };

      const total = parseInt(res?.total || '0', 10);

      return { resumen, data, page, limit, total };
    } catch (error) {
      this.logger.error('Error en getRetencionSocios', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Recuperabilidad de Cartera Vencida
  // ─────────────────────────────────────────────────────────────────────────────
  async getRecuperabilidadCartera(page: number, limit: number, segmento?: string): Promise<RecuperabilidadResponseDto> {
    try {
      const offset = (page - 1) * limit;

      const baseSql = \`
        WITH base AS (
          SELECT
            nro_cliente,
            nombres_socio,
            nro_operacion,
            CAST(NULLIF(dias_mora, '') AS INT) AS dias_mora,
            CAST(saldo_capital AS FLOAT) AS saldo_vencido,
            -- Mock de datos no disponibles
            'Hipotecaria' AS tipo_garantia,
            1000 AS ingresos
          FROM sabana_credito
          WHERE estado_op = 'VIGENTE'
            AND CAST(NULLIF(dias_mora, '') AS FLOAT) > 0
        ),
        resultado AS (
          SELECT
            *,
            CASE
              WHEN dias_mora < 30 THEN 'Alta'
              WHEN dias_mora < 90 THEN 'Media'
              ELSE 'Baja'
            END AS segmento,
            100 - LEAST(90, dias_mora * 0.5) AS score_recuperacion,
            'Garantía real' AS factor_positivo
          FROM base
        )
      \`;

      let filtro = '';
      if (segmento) {
        filtro = \`WHERE segmento = '\${segmento}'\`;
      }

      const sql = \`
        \${baseSql}
        SELECT * FROM resultado
        \${filtro}
        ORDER BY score_recuperacion DESC
        LIMIT $1 OFFSET $2;
      \`;

      const sqlResumen = \`
        \${baseSql}
        SELECT
          COUNT(*) FILTER (WHERE segmento = 'Alta') AS total_alta,
          COUNT(*) FILTER (WHERE segmento = 'Media') AS total_media,
          COUNT(*) FILTER (WHERE segmento = 'Baja') AS total_baja,
          COALESCE(SUM(saldo_vencido) FILTER (WHERE segmento = 'Alta'), 0) AS monto_alta,
          COALESCE(SUM(saldo_vencido) FILTER (WHERE segmento = 'Media'), 0) AS monto_media,
          COALESCE(SUM(saldo_vencido) FILTER (WHERE segmento = 'Baja'), 0) AS monto_baja,
          COUNT(*) AS total
        FROM resultado
        \${filtro};
      \`;

      const [rows, [res]] = await Promise.all([
        this.sabanaCreditoRepo.query(sql, [limit, offset]),
        this.sabanaCreditoRepo.query(sqlResumen),
      ]);

      const data = rows.map((r: any) => ({
        nroCliente: String(r.nro_cliente),
        nombresSocio: r.nombres_socio,
        nroOperacion: r.nro_operacion,
        diasMora: parseInt(r.dias_mora || 0, 10),
        saldoVencido: parseFloat(r.saldo_vencido || 0),
        tipoGarantia: r.tipo_garantia,
        segmento: r.segmento,
        scoreRecuperacion: parseFloat(r.score_recuperacion || 0),
        factorPositivo: r.factor_positivo,
        ingresos: parseFloat(r.ingresos || 0),
      }));

      const resumen = {
        totalAlta: parseInt(res?.total_alta || '0', 10),
        totalMedia: parseInt(res?.total_media || '0', 10),
        totalBaja: parseInt(res?.total_baja || '0', 10),
        montoAlta: parseFloat(res?.monto_alta || '0'),
        montoMedia: parseFloat(res?.monto_media || '0'),
        montoBaja: parseFloat(res?.monto_baja || '0'),
      };

      const total = parseInt(res?.total || '0', 10);

      return { resumen, data, page, limit, total };
    } catch (error) {
      this.logger.error('Error en getRecuperabilidadCartera', error);
      throw error;
    }
  }
}
`;
  fs.writeFileSync('src/modules/dashboard/dashboard.service.ts', newContent);
  console.log('Fixed successfully');
} else {
  console.log('Could not match getConcentracionCartera');
}

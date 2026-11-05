# FactoryPulse Monorepo

Plataforma de telemetria industrial construída em arquitetura de microserviços com **NestJS**, **RabbitMQ**, **PostgreSQL + TimescaleDB** e **Next.js**.

---

## Estrutura do Monorepo

```text
FactoryPulse/
├── apps/
│   ├── factory-pulse/              # Monorepo Backend NestJS
│   │   ├── apps/
│   │   │   ├── ingestion-service/  # API HTTP (porta 3000) para ingestão de pulsos dos sensores
│   │   │   ├── consumer-worker/    # Worker RabbitMQ que persiste em lote no TimescaleDB
│   │   │   └── query-service/      # API HTTP (porta 3001) que expõe leituras, total e média via POST
│   │   └── libs/
│   │       └── common/             # Constantes, contratos e tipagens compartilhadas (@app/common)
│   └── dashboard/                  # Frontend Next.js (porta 3002) com gráficos interativos (Recharts)
├── programs/                       # Programas auxiliares / scripts de sensores e automação
├── docker-compose.yml              # Orquestração completa (RabbitMQ, TimescaleDB, Backend e Frontend)
├── package.json                    # Scripts globais do workspace
└── pnpm-workspace.yaml             # Configuração do workspace pnpm
```

---

## Serviços e Portas

| Serviço | Container | Porta | Descrição |
| :--- | :--- | :--- | :--- |
| **Ingestion Service** | `factory-pulse-ingestion` | `3000` | Recebe `POST /ingest` dos sensores a cada 10 min e publica na fila do RabbitMQ |
| **Consumer Worker** | `factory-pulse-consumer` | *(worker)* | Consome `sensor_pulse_queue` do RabbitMQ e grava em lote (`UNNEST`) na hypertable TimescaleDB |
| **Query Service** | `factory-pulse-query` | `3001` | Expõe `POST /readings` com filtros e retorna leituras, `total` e `average` por sensor |
| **Dashboard Web** | `factory-pulse-dashboard` | `3002` | Interface Next.js com gráficos de série temporal e comparativo de sensores |
| **RabbitMQ** | `factory-pulse-rabbitmq` | `5672` / `15672` | Broker AMQP (`5672`) e painel web de gerenciamento (`http://localhost:15672`) |
| **TimescaleDB** | `factory-pulse-timescaledb` | `5432` | PostgreSQL 16 + extensão `timescaledb` (`hypertable` sem duplicatas por `time + channel`) |

---

## Contratos de Dados

### 1. Envio do Sensor (`POST http://localhost:3000/ingest`)

```json
{
  "1": [
    { "time": "2026-11-05T14:10:00.000Z", "stack": 1 }
  ],
  "0": [
    { "time": "2026-11-05T14:10:00.000Z", "stack": 0 }
  ],
  "3": [
    { "time": "2026-11-05T14:10:00.000Z", "stack": 0 }
  ],
  "2": [
    { "time": "2026-11-05T14:10:00.000Z", "stack": 0 }
  ]
}
```

### 2. Consulta para o Frontend (`POST http://localhost:3001/readings`)

**Request Body (todos os filtros são opcionais):**
```json
{
  "startTime": "2026-11-05T00:00:00.000Z",
  "endTime": "2026-11-05T23:59:59.999Z",
  "channels": ["0", "1", "2", "3"],
  "limit": 200
}
```

**Response Body:**
```json
{
  "0": {
    "readings": [
      { "time": "2026-11-05T14:10:00.000Z", "stack": 0 }
    ],
    "total": 0,
    "average": 0
  },
  "1": {
    "readings": [
      { "time": "2026-11-05T14:10:00.000Z", "stack": 1 }
    ],
    "total": 1,
    "average": 1
  }
}
```

---

## Como Executar

### Opção 1: Subir Tudo com Docker Compose (Recomendado)

Na raiz do monorepo (`d:\Projetos\FactoryPulse`):

```bash
pnpm run docker:up
# ou: docker compose up -d --build
```

- **Dashboard**: http://localhost:3002
- **Ingestion API**: http://localhost:3000/health
- **Query API**: http://localhost:3001/health
- **RabbitMQ Management**: http://localhost:15672 (`guest` / `guest`)

### Opção 2: Desenvolvimento Local

Suba apenas a infraestrutura (`rabbitmq` e `timescaledb`) via Docker e rode os serviços a partir da raiz:

```bash
docker compose up -d rabbitmq timescaledb

# Em terminais separados na raiz do monorepo:
pnpm run dev:ingestion
pnpm run dev:consumer
pnpm run dev:query
pnpm run dev:dashboard
```

### Testes e Build

```bash
# Executar testes unitários
pnpm test

# Compilar todos os pacotes (Backend + Dashboard)
pnpm run build
```


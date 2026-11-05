local MODEM_SIDE = "top" -- Ajuste para o lado do modem
local ARQUIVO_LOG = "historico_esteiras.json"
local URL_INGEST = "http://127.0.0.1:3000/ingest"
local INTERVALO_POST = 600 -- 10 minutos em segundos

rednet.open(MODEM_SIDE)

local buffer_ultimos_10m = {}

local function registrar_entrada(id_esteira, time_iso, stack)
    local chave = tostring(id_esteira)
    local entrada = {
        time = time_iso,
        stack = stack
    }

    -- 1. Acumula no buffer dos últimos 10 minutos para o POST
    if type(buffer_ultimos_10m[chave]) ~= "table" then
        buffer_ultimos_10m[chave] = {}
    end
    table.insert(buffer_ultimos_10m[chave], entrada)

    -- 2. Salva no arquivo JSON local
    local historico = {}
    if fs.exists(ARQUIVO_LOG) then
        local f_leitura = fs.open(ARQUIVO_LOG, "r")
        if f_leitura then
            local conteudo = f_leitura.readAll()
            f_leitura.close()
            local dados = textutils.unserializeJSON(conteudo)
            if type(dados) == "table" then
                historico = dados
            end
        end
    end

    if type(historico[chave]) ~= "table" then
        historico[chave] = {}
    end
    table.insert(historico[chave], entrada)

    local f_escrita = fs.open(ARQUIVO_LOG, "w")
    if f_escrita then
        f_escrita.write(textutils.serializeJSON(historico))
        f_escrita.close()
    end
end

local function enviar_post_10m()
    if next(buffer_ultimos_10m) == nil then
        print("[HTTP] Nenhum dado acumulado nos ultimos 10 min para enviar.")
        return
    end

    local payload = textutils.serializeJSON(buffer_ultimos_10m)
    local headers = { ["Content-Type"] = "application/json" }

    print("[HTTP] Enviando dados dos ultimos 10 min para " .. URL_INGEST .. "...")
    local resposta, erro = http.post(URL_INGEST, payload, headers)

    if resposta then
        local status = resposta.getResponseCode()
        resposta.close()
        print(string.format("[HTTP] Sucesso (Status %d). Buffer limpo.", status))
        buffer_ultimos_10m = {}
    else
        print("[HTTP] Falha no POST: " .. tostring(erro))
    end
end

term.clear()
term.setCursorPos(1, 1)
print("=== Servidor de Sincronizacao ===")
print("Pressione [ENTER] para iniciar todas as esteiras sincronizadas...")

-- Aguarda o usuário apertar Enter no servidor
while true do
    local evento, tecla = os.pullEvent("key")
    if tecla == keys.enter then
        break
    end
end

-- Dispara o gatilho simultaneo para todos os clientes ouvindo o canal
print("\n[!] Enviando sinal de largada...")
rednet.broadcast("START_SYNC", "sincronia_esteiras")

-- Inicia o timer de 10m com +2s de folga para garantir que o 10º minuto dos clientes chegue antes do POST
local timer_post = os.startTimer(INTERVALO_POST + 2)

print("Coletando dados em segundo plano (POST a cada 10m)...\n")

while true do
    local evento, p1, p2, p3 = os.pullEvent()

    if evento == "rednet_message" then
        local senderId, dados, protocolo = p1, p2, p3
        if protocolo == "sincronia_esteiras" and type(dados) == "table" and dados.tipo == "RELATORIO" then
            local ts = dados.time or dados.timestampz or os.date("!%Y-%m-%dT%H:%M:%S.000Z")
            local s = dados.stack or dados.itens
            registrar_entrada(senderId, ts, s)
        end

    elseif evento == "timer" and p1 == timer_post then
        enviar_post_10m()
        timer_post = os.startTimer(INTERVALO_POST)
    end
end
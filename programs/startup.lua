local MODEM_SIDE = "top"    -- Lado do modem
local LADO_SENSOR = "back"  -- Lado conectado ao Content Observer

rednet.open(MODEM_SIDE)

term.clear()
term.setCursorPos(1, 1)
print("=== Cliente de Esteira ===")
print("ID Local: " .. os.getComputerID())
print("Aguardando sinal de largada do servidor...\n")

-- Fica travado aqui ate o servidor mandar o comando
while true do
    local senderId, comando, protocolo = rednet.receive("sincronia_esteiras")
    if comando == "START_SYNC" then
        print("[!] Sinal de sincronizacao recebido do Servidor #" .. senderId)
        break
    end
end

-- ==========================================
-- INICIO DO MONITORAMENTO SINCRONIZADO
-- ==========================================
local itens_no_minuto = 0
local total_itens = 0
local minutos_decorridos = 0
local estado_anterior = redstone.getInput(LADO_SENSOR)

-- Inicia o timer exatamente no momento da ordem do servidor
local timer_id = os.startTimer(60)
print("Monitoramento iniciado. Enviando dados a cada 60s.\n")

while true do
    local evento, p1 = os.pullEvent()

    -- Deteccao de item passando na esteira
    if evento == "redstone" then
        local estado_atual = redstone.getInput(LADO_SENSOR)
        if estado_atual and not estado_anterior then
            itens_no_minuto = itens_no_minuto + 1
        end
        estado_anterior = estado_atual

    -- Minuto fechado
    elseif evento == "timer" and p1 == timer_id then
        minutos_decorridos = minutos_decorridos + 1
        total_itens = total_itens + itens_no_minuto
        local media_geral = total_itens / minutos_decorridos

        -- Exibe localmente
        print(string.format("Minuto %d: %d itens (Media: %.2f)", 
            minutos_decorridos, itens_no_minuto, media_geral))

        -- Envia os dados de volta ao servidor central
        rednet.broadcast({
            tipo = "RELATORIO",
            time = os.date("!%Y-%m-%dT%H:%M:%S.000Z"),
            stack = itens_no_minuto,
            media = media_geral
        }, "sincronia_esteiras")

        -- Reseta para o proximo intervalo de 60 segundos
        itens_no_minuto = 0
        timer_id = os.startTimer(60)
    end
end
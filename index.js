const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());


app.post("/perguntar", async (req, res) => {
    const { pergunta } = req.body;

    if (!pergunta) {
        return res
            .status(400)
            .json({ erro: 'Envie o campo "pergunta" no corpo da requisição.' });
    }

    try {
        // Requisição ao Azure Cognitive Services
        const azureResponse = await axios.post(
            process.env.AZURE_ENDPOINT,
            {
                kind: "Conversation",
                analysisInput: {
                    conversationItem: {
                        id: "12345",
                        text: pergunta,
                        modality: "text",
                        language: "PT-BR",
                        participantId: "12344566",
                    },
                },
                parameters: {
                    projectName: "ChatBotDistribuidora",
                    verbose: true,
                    deploymentName: "TesteDeploy",
                    stringIndexType: "TextElement_V8",
                },
            },
            {
                headers: {
                    "Ocp-Apim-Subscription-Key": process.env.AZURE_API_KEY,
                    "Apim-Request-Id": process.env.REQUEST_ID,
                    "Content-Type": "application/json",
                },
            }
        ).then(res => res.data);

        console.log(azureResponse);

        const topIntent = azureResponse.result.prediction.topIntent;
        const entities = azureResponse.result.prediction.entities;

        console.log(`Intenção: ${topIntent}`);
        console.log(`Entidades: ${JSON.stringify(entities)}`);
        let response = "";

        const pedidos = fs.readFileSync("./dataset/pedidos.csv", "utf-8");
        const produtos = fs.readFileSync("./dataset/produtos.csv", "utf-8");
        const prazos = fs.readFileSync("./dataset/prazos.csv", "utf-8");

        const pedidosData = [];
        const produtosData = [];
        const prazosData = [];

        pedidos
            .split("\r").join("")
            .split("\n")
            .slice(1)
            .forEach((line) => {
                const [id, produto, quantidade, data, status, localizacao, prazo_previsto] = line.split(",");
                pedidosData.push({ id, produto, quantidade, data, status, localizacao, prazo_previsto });
            });

        produtos
            .split("\r").join("")
            .split("\n")
            .slice(1)
            .forEach((line) => {
                const [id, nome, categoria, quantidade, preco, fornecedor] = line.split(",");
                produtosData.push({ id, nome: nome.toLowerCase(), categoria, quantidade, preco, fornecedor });
            });

        prazos
            .split("\r").join("")
            .split("\n")
            .slice(1)
            .forEach((line) => {
                const [cidade, estado, tempo_min, tempo_max, transportadora] = line.split(",");
                prazosData.push({ cidade: cidade.toLowerCase(), estado: estado.toLowerCase(), tempo_min, tempo_max, transportadora: transportadora.toLowerCase() });
            });

        console.log("Verificando intenção e entidades...");

        switch (topIntent){
            case "rastrear_entrega":
                if (!entities?.[0]?.text) {
                    return res.status(200).json({ resposta: 'Envie o ID do pedido para rastreamento.' });
                }

                const pedidoId = entities[0].text;
                const entregaEncontrada = pedidosData.find(p => p.id === pedidoId);

                if (!entregaEncontrada) {
                    return res.status(200).json({ resposta: 'Pedido não encontrado.' });
                }

                response = `O pedido ${entregaEncontrada.id} está com status ${entregaEncontrada.status} e está localizado em ${entregaEncontrada.localizacao}, prazo de entrega: ${entregaEncontrada.prazo_previsto.split("-").reverse().join("/")}.`;
                break;
            case "consultar_estoque":
                if (!entities?.[0]?.text) {
                    return res.status(200).json({ resposta: 'Envie o nome do produto para consulta.' });
                }

                const produtoConsulta = entities[0].text;
                const produtoEncontrado = produtosData.find(p => p.nome === produtoConsulta);

                if (!produtoEncontrado) {
                    return res.status(200).json({ resposta: 'Produto não encontrado.' });
                }

                response = `O produto ${produtoEncontrado.nome} está disponível em estoque com ${produtoEncontrado.quantidade} unidades.`;
                break;
            case "consultar_pedido":
                if (!entities?.[0]?.text) {
                    return res.status(200).json({ resposta: 'Envie o ID do pedido para consulta.' });
                }

                const pedidoConsulta = entities[0].text;
                const pedidoEncontrado = pedidosData.find(p => p.id === pedidoConsulta);

                if (!pedidoEncontrado) {
                    return res.status(200).json({ resposta: 'Pedido não encontrado.' });
                }

                response = `O pedido ${pedidoEncontrado.id} está com status ${pedidoEncontrado.status} e está localizado em ${pedidoEncontrado.localizacao}, prazo de entrega: ${pedidoEncontrado.prazo_previsto.split("-").reverse().join("/")}.`;
                break;
            case "entrega_sabado":
            case "horario_atendimento":
                response = "Nosso horário de atendimento é de segunda a sexta-feira, das 8h às 18h. Não realizamos entregas aos sábados.";
                break;
            case "prazo_entrega":
                if (!entities?.[0]?.text) {
                    return res.status(200).json({ resposta: 'Envie a cidade para consulta do prazo de entrega.' });
                }

                const cidadeConsulta = entities[0].text;
                const prazoEncontrado = prazosData.find(p => p.cidade.toLowerCase() === cidadeConsulta.toLowerCase());

                if (!prazoEncontrado) {
                    return res.status(200).json({ resposta: 'Prazo de entrega não encontrado para a cidade informada.' });
                }

                response = `O prazo de entrega para ${prazoEncontrado.cidade} é de ${prazoEncontrado.tempo_min} a ${prazoEncontrado.tempo_max} dias úteis, com a transportadora ${prazoEncontrado.transportadora}.`;
                break;
            case "telefone_contato":
                response = "Nosso telefone de contato é (11) 1234-5678.";
                break;
            case "cancelar_pedido":
                if (!entities?.[0]?.text) {
                    return res.status(200).json({ resposta: 'Envie o ID do pedido para cancelamento.' });
                }

                const pedidoCancelamento = entities[0].text;
                const pedidoParaCancelar = pedidosData.find(p => p.id === pedidoCancelamento);

                if (!pedidoParaCancelar) {
                    return res.status(200).json({ resposta: 'Pedido não encontrado.' });
                }

                // Simulação de cancelamento
                pedidosData = pedidosData.filter(p => p.id !== pedidoCancelamento);
                response = `O pedido ${pedidoParaCancelar.id} foi cancelado com sucesso.`;
                break;
        }

        res.status(200).json({ resposta: response });
    } catch (error) {
        console.error(error?.response?.data || error.message);
        res.status(500).json({
            erro: "Erro ao consultar Azure Cognitive Services.",
        });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`API rodando na porta ${PORT}`);
});

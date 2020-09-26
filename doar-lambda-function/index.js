const fs = require("fs");
const Boleto = require("boleto-node").Boleto;
const AWS = require("aws-sdk");
const accessKeyId = process.env.ACCESS_KEY_ID;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;
const filePath = "/tmp/boleto.html";

const s3 = new AWS.S3({
  accessKeyId,
  secretAccessKey
});

function generateBoleto(name, donationValue, CPF) {
  const boleto = new Boleto({
    banco: "bradesco", // nome do banco dentro da pasta 'banks'
    data_emissao: new Date(),
    data_vencimento: new Date(new Date().getTime() + 5 * 24 * 3600 * 1000), // 5 dias futuramente
    valor: donationValue * 100, // (valor em centavos)
    nosso_numero: "23791",
    numero_documento: "000061911155-0",
    instrucoes:
      "Sr. Caixa, aceitar o pagamento e não cobrar juros após o vencimento. \n A emissão deste boleto foi solicitada e/ou intermediada pela empresa TM - CNPJ: 19240580000112", //
    pagador: name,
    pagador_cpf_cnpj: CPF,
    pagador_endereco_rua_num: "RUA SÃO CARLOS AUGUSTINO DA SILVA, 50",
    pagador_endereco_bairro: "SÃO JOÃO BATISTA DA SILVA",
    pagador_endereco_cep: "15.160-100",
    pagador_endereco_cidade_estado: "SÃO JOSÉ DOS TESTES - SP",
    pagador_outras_informacoes: "Login da central: testeteste",
    cedente: "Teto - TM | Pagar.me Pagamentos S/A",
    cedente_cnpj: "18727053000174", // sem pontos e traços
    cedente_endereco_rua_num: "RUA CEL. JONAS DOS SANTOS, 130",
    cedente_endereco_bairro: "CENTRO",
    cedente_endereco_cep: "15.115-100",
    cedente_endereco_cidade_estado: "SÃO JOSÉ DOS TESTES - SP",
    agencia: "6119",
    codigo_cedente: "001.584-2",
    carteira: "09",
  });

  return new Promise((res, rej) => {
    boleto.renderHTML("boleto", true, function (html) {
      fs.writeFile(filePath, html, function (err) {
        if (err) throw err;
        res();
        console.log("Saved!");
      });
    });
  });
}

let boletoAWSPath = "";

const uploadFile = async () => {
  const data = fs.readFileSync(filePath);

  const params = {
    Bucket: "teto-boleto",
    Key: `boleto-${new Date().getTime().toString()}.html`,
    Body: data,
  };

  return new Promise((res, rej) => {
    s3.upload(params, function (s3Err, data) {
      boletoAWSPath = data.Location;
      if (s3Err) {
        rej();
        throw s3Err;
      }
      console.log(`File uploaded successfully at ${data.Location}`);
      res();
    });
  });
};

module.exports.handler = async (event) => {
  const slots = event.currentIntent.slots;
  const name = slots["Nome"];
  const donationValue = slots["Valor"];
  const CPF = slots["CPF"];
  const confirmation = slots["Confirmacao"];

  if (confirmation === "no") {
    const message =
      "Ok, estou cancelando o processo de doação! Se mudar de ideia, estarei aqui :)";
    return close(message, "Fulfilled");
  } else {
    try {
      await generateBoleto(name, donationValue, CPF);
      await uploadFile();
      
      const message = `Muito obrigado pela sua solidariedade! Acesse o boleto e realize o pagamento, por favor. Link: ${boletoAWSPath}`;
      return close(message, "Fulfilled");
    } catch (error) {
      console.log(error);
      let message = "Desculpe, houve um erro inesperado ao gerar seu boleto :(";

      return close(message, "Failed");
    }
  }
};

function close(message, fulfillmentState) {
  return {
    dialogAction: {
      type: "Close",
      fulfillmentState,
      message: {
        contentType: "PlainText",
        content: message,
      },
    },
  };
}

function elicit_slot(message, intentName, slots, slotToElicit) {
  return {
    dialogAction: {
      type: "ElicitSlot",
      message: {
        contentType: "PlainText",
        content: message,
      },
      intentName,
      slots,
      slotToElicit,
    },
  };
}

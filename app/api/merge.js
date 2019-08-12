//const Conteudo = require('mongoose').model('Conteudo');
const Version = require('mongoose').model('Version');

const express = require('express')
require('../../config/database')
const natural = require('natural');
const wordnet = new natural.WordNet();
//const rp = require('request-promise')
const Promise = require('promise');

/**
 * Algoritmo desenvolvido com o objetivo de implementar uma nova funcionalidade na plataforma CMPaaS.
 * Esta ferramenta realiza a fusao de dois ou mais mapas conceituais com o proposito de gerar um novo 
 * mapa mais completo e com mais conteudo sobre um determinado dominio.
 * @version 1.0 
 * @author Luiz Carlos Passamani Filho – Universidade Federal do Espirito Santo 
 */


module.exports = app => {

    const api = {};

    api.merge = async (req, res) => {
        try {

            if (req.body.maps) {
                mapInicial = await fusionConceptsAndRelations(req.body)
                mapParcial = await fusionConceptsEqualsAndLink(mapInicial)

                await fusionConceptsSynonymous(mapParcial, res)


            } else if (req.body.versionIds) {
                mapInicial = await fusionConceptsAndRelationsByVersionIds(req.body)
                mapParcial = await fusionConceptsEqualsAndLink(mapInicial)

                await fusionConceptsSynonymous(mapParcial, res)

            }
        } catch (e) {
            res.status(400).send(e)
        }
    }

    return api;

}

// FUNCTION:
// INPUT: Array de arquivos Json. Cada elemento contém as informacoes de um mapa conceitual, no formato do object content
// OUTPUT: Variavel contendo todos os conceitos e relacoes em um unico mapa conceitual
const fusionConceptsAndRelations = async (body) => {

    const mapFusion = { nodeDataArray: [], linkDataArray: [] } //new Conteudo() //INICIALIZA COLECTION CONTEUDO

    if (!mapFusion) { //VERIFICA INTEGRIDADE DO ARQUIVO
        return console.log('erro ao inicializar estrutura do mapa conceitual')//res.status(400).send({ error: 'Invalid Maps!' })
    }

    for (var k = 0; k < body.maps.length; k++) { //LACO DE REPETICAO COM O NUMERO DE MAPAS NO ARQUIVO JSON
        const mapa = body.maps[k]

        for (var i = 0; i < mapa.nodeDataArray.length; i++) { //ADICIONAR TODOS CONCEITOS E RELACOES EM APENAS UM ARQUIVO NO FORMATO DO ARQUIVO CONTENT QUE ESTA NA COLECAO VERSIONS
            await mapFusion.nodeDataArray.push({
                text: mapa.nodeDataArray[i].text,
                category: mapa.nodeDataArray[i].category,
                key: mapa.nodeDataArray[i].key,
                loc: mapa.nodeDataArray[i].loc,
                merged: []
            })
        }
        for (var j = 0; j < mapa.linkDataArray.length; j++) { //ADICIONAR TODOS AS LIGACOES EM APENAS UM ARQUIVO NO FORMATO DO ARQUIVO CONTENT QUE ESTA NA COLECAO VERSIONS
            await mapFusion.linkDataArray.push({
                from: mapa.linkDataArray[j].from,
                to: mapa.linkDataArray[j].to,
                key: mapa.linkDataArray[j].key
            })
        }
    }

    return mapFusion
}

// FUNCTION:
// INPUT: Array de arquivos Json. Cada elemento contém os Id de um mapa conceitual
// OUTPUT: Variavel atualzada contendo todos os conceitos e relacoes em um unico mapa conceitual
const fusionConceptsAndRelationsByVersionIds = async (body) => {

    const mapFusion = { nodeDataArray: [], linkDataArray: [] }
    if (!mapFusion) {
        return console.log('erro ao inicializar estrutura do mapa conceitual')
    }
    versions = body.versionIds
    for (var i = 0; i < versions.length; i++) {
        const mapa = await Version.findById(versions[i].key)
        if (!mapa) {
            throw new Error()
        }
        for (var m = 0; m < mapa.content.nodeDataArray.length; m++) {
            await mapFusion.nodeDataArray.push({
                text: mapa.content.nodeDataArray[m].text,
                category: mapa.content.nodeDataArray[m].category,
                key: mapa.content.nodeDataArray[m].key,
                loc: mapa.content.nodeDataArray[m].loc,
                merged: []
            })
        }
        for (var j = 0; j < mapa.content.linkDataArray.length; j++) {
            await mapFusion.linkDataArray.push({
                from: mapa.content.linkDataArray[j].from,
                to: mapa.content.linkDataArray[j].to,
                key: mapa.content.linkDataArray[j].key,
                points: mapa.content.linkDataArray[j].points
            })
        }
    }
    return mapFusion
}

// FUNCTION:
// INPUT: Object do tipo content com os dados do mapa conceitual
// OUTPUT: Variavel atualzada contendo todos os conceitos e relacoes em um unico mapa conceitual
const fusionConceptsEqualsAndLink = function (mapa) {

    mapa.nodeDataArray.forEach(function (mapaI, indexI) {
        mapa.nodeDataArray.forEach(function (mapaJ, indexJ) {
            if (indexI != indexJ) {
                if (mapaI.category == "concept" && mapaJ.category == "concept") {
                    if (mapaI.text == mapaJ.text) {
                        mapa.linkDataArray.forEach(function (mapaLink) {
                            if (mapaLink.to == mapaJ.key) {
                                mapaLink.to = mapaI.key;
                            }
                            if (mapaLink.from == mapaJ.key) {
                                mapaLink.from = mapaI.key; //na hora de fundir dois mapas exatamentes iguais, ta sobrando relacao... mas se tirar esse link alguns conceitos ficam sem link
                            }
                        })
                        mapa.nodeDataArray[indexI].merged.push(
                            mapa.nodeDataArray[indexJ].text + '(equal)'
                        )                        
                        mapa.nodeDataArray[indexI].color = "#4caf50"
                        delete mapa.nodeDataArray[indexJ]
                    }
                }
            }
        })
    })

    return mapa
}

// FUNCTION:
// INPUT: Object do tipo content com os dados do mapa conceitual
// OUTPUT: Variavel atualzada contendo todos os conceitos e relacoes em um unico mapa conceitual

const fusionConceptsSynonymous = function (mapa, res) {
    var numConcept = 0
    var condicaoDeRetorno = 0
    var auxNumConcept = 0
    for (var c = 0; c < mapa.nodeDataArray.length; c++) {
        if (mapa.nodeDataArray[c]) {
            if (mapa.nodeDataArray[c].category == "concept") {
                numConcept = numConcept + 1
                auxNumConcept = auxNumConcept + 1
            }
        }
    }

    console.log("\x1b[31m", 'Aguarde o fim da fusao dos mapas conceituais... ( ' + numConcept + " conceitos a serem comparados)")

    //promise1 tem como objetivo retornar os dados do object mapa somente quando todas as requisicoes para o modulo natural tereminarem
    let promise1 = new Promise((resolve, reject) => {

        mapa.nodeDataArray.forEach(function (mapaI, indexI) {
            mapa.nodeDataArray.forEach(function (mapaJ, indexJ) {
                if (indexJ > indexI) {
                    if (mapaI.category == "concept" && mapaJ.category == "concept") {
                        wordnet.lookup(mapaI.text, function (resultsX) {
                            wordnet.lookup(mapaJ.text, function (resultsY) {
                                resultsX.forEach(function (resultX) {
                                    resultsY.forEach(function (resultY) {
                                        if (resultX.synsetOffset == resultY.synsetOffset) {
                                            mapa.linkDataArray.forEach(function (mapaLink) {
                                                if (mapaLink.to == mapaJ.key) {
                                                    mapaLink.to = mapaI.key;
                                                }
                                                else if (mapaLink.from == mapaJ.key) {
                                                    mapaLink.from = mapaI.key; //o link sempre parte do conceito para a relacao, nunca o contratio
                                                }
                                            })
                                            mapa.nodeDataArray[indexI].merged.push(
                                                mapa.nodeDataArray[indexJ].text
                                            )
                                            mapa.nodeDataArray[indexI].color = "#4caf50"
                                            mapa.nodeDataArray[indexJ].deleted = true
                                        }
                                    })
                                })
                                condicaoDeRetorno = condicaoDeRetorno + 1
                                console.log(((condicaoDeRetorno / ((numConcept * (numConcept - 1)) / 2)) * 100).toFixed(1) + ' %')
                                if (condicaoDeRetorno == (numConcept * (numConcept - 1)) / 2) {
                                    resolve(mapa);
                                }
                            })
                        })
                    }
                }
            })
        })
    })
    //ANTES DE DELETAR OS ELEMENTOS COM DELETED = TRUE, TEM QUE FAZER UMA OUTRA PROMISE PARA PASSAR PELA NODEDATAARRAY EM BUSCA DE RELATION QUE NAO TENHA LINK COM NINGUEM
    promise1.then((resultado) => {
        console.log('TAm = ' + resultado.nodeDataArray.length)


        //promiseCleanNull tem como objetivo retornar os dados do object mapa somente quando for removido todos elementos null da array NodeDataArray
        let promiseCleanNull = new Promise((resolve, reject) => {

            for (var i = 0; i < resultado.nodeDataArray.length; i++) {

                if (resultado.nodeDataArray[i] == null) {
                    resultado.nodeDataArray.splice(i, 1); //tava mapa, troquei para resultado. caso de erro futuramente
                    i = i - 1
                }
                if (resultado.nodeDataArray[i].deleted == true) {
                    resultado.nodeDataArray.splice(i, 1); //tava mapa, troquei para resultado. caso de erro futuramente
                    i = i - 1
                }
                console.log('tam = ' + i + ' e ' + resultado.nodeDataArray.length)
                if (i == resultado.nodeDataArray.length - 1) {
                    resolve(resultado)
                }
            }

        })
        promiseCleanNull.then((resultado) => {



            let promiseCleanRelationNull = new Promise((resolve, reject) => {
                for (var i = 0; i < resultado.linkDataArray.length; i++) {
                    var auxLink = false
                    //if (resultado.nodeDataArray[i].category == "relation") {
                    for (var j = 0; j < resultado.nodeDataArray.length; j++) {
                        if (resultado.linkDataArray[i].from == resultado.nodeDataArray[j].key) {
                                auxLink = true
                        }
                    }
                    if (auxLink == false) {
                        for (var k = 0; k < resultado.nodeDataArray.length; k++) {
                            if (resultado.nodeDataArray[k].category == "relation") {
                                if (resultado.nodeDataArray[k].key == resultado.linkDataArray[i].to) {
                                    resultado.nodeDataArray.splice(k, 1); 
                                    k = k - 1
                                }
                            }
                        }
                    }
                    if (i == resultado.linkDataArray.length - 1) {
                        resolve(resultado)
                    }
                }
            })
            promiseCleanRelationNull.then((resultadoFinal) => {
                console.log("\x1b[42m", "\x1b[37m", 'FIM ✓ ')
                res.json({
                    resultadoFinal
                })
            })
//TENTAR EXCLUIR AS RELACOES LIGADAS AO MESMO CONCEITO, FAZER UM LOOP COMPARANDO O FROM/TO COM OS TO/FROM E PROCURAR POR IGUALDADE
        })

    })
}


/*

else if (resultado.nodeDataArra[i].text == "relation") {
                        auxLink = false
                        for (var j = 0; j < resultado.nodeDataArray.length; j++) {
                            if (resultado.nodeDataArray[i].key == resultado.linkDataArray[j].from) {
                                auxLink = true
                            }
                            if (auxLink = true) {
                                resultado.nodeDataArray.splice(i, 1); //tava mapa, troquei para resultado. caso de erro futuramente
                                i = i - 1
                            }
                        }
                    }

*/

/*------------------------------------PROMISE PARA TENTAR APAGAR AS RELACOES SEM LINK NO MAPA------------------------------------------------------
let auxDeleteLink = false

let promiseCleanRelationNull = new Promise((resolve, reject) => {
    resultado.nodeDataArray.forEach(function (relation, indexRI) {
        if (relation.category == "relation") {

            resultado.linkDataArray.forEach(function (link, indexRJ) {
                if (relation.key == link.from || relation.key == link.to) {
                    auxDeleteLink = true
                }
            })
            if (auxDeleteLink == false) {
                relation.deleted = true
                console.log('encontrou igual!!')
            }
            auxDeleteLink = false
        }
    })
    if (indexRI == resultado.nodeDataArray.length) {
        resolve(resultado)
    }
})
---------------------------------------------------------------------------------------------------------------------------*/







/*

const fusionConceptsSynonymous = function (mapa, res) {
    var numConcept = 0
    var condicaoDeRetorno = 0
    var auxNumConcept = 0
    for (var c = 0; c < mapa.nodeDataArray.length; c++) {
        if (mapa.nodeDataArray[c]) {
            if (mapa.nodeDataArray[c].category == "concept") {
                numConcept = numConcept + 1
                auxNumConcept = auxNumConcept + 1
            }
        }
    }

    console.log("\x1b[31m", 'Aguarde o fim da fusao dos mapas conceituais... ( ' + numConcept + " conceitos a serem comparados)")

    //promise1 tem como objetivo retornar os dados do object mapa somente quando todas as requisicoes para o modulo natural tereminarem
    let promise1 = new Promise((resolve, reject) => {

        mapa.nodeDataArray.forEach(function (mapaI, indexI) {
            mapa.nodeDataArray.forEach(function (mapaJ, indexJ) {
                if (indexJ > indexI) {
                    if (mapaI.category == "concept" && mapaJ.category == "concept") {

                        wordnet.lookup(mapaI.text, function (resultsX) {
                            wordnet.lookup(mapaJ.text, function (resultsY) {
                                resultsX.forEach(function (resultX) {
                                    resultsY.forEach(function (resultY) {
                                        if (resultX.synsetOffset == resultY.synsetOffset) {
                                            //console.log('encontrou sinonimos: ' + mapaI.text + ' = ' + mapaJ.text)

                                            mapa.linkDataArray.forEach(function (mapaLink) {
                                                if (mapaLink.to == mapaJ.key) {
                                                    mapaLink.to = mapaI.key;
                                                }
                                                else if (mapaLink.from == mapaJ.key) {
                                                    //mapaLink.from = mapaI.key; //o link sempre parte do conceito para a relacao, nunca o contratio
                                                }
                                            })
                                            mapa.nodeDataArray[indexI].merged.push(
                                                mapa.nodeDataArray[indexJ].text
                                            )
                                            mapa.nodeDataArray[indexI].color = "#4caf50"
                                            //console.log('teste' + mapa.nodeDataArray[indexI].merged)

                                            mapa.nodeDataArray[indexJ].deleted = true

                                        }
                                    })
                                })
                                condicaoDeRetorno = condicaoDeRetorno + 1
                                console.log(((condicaoDeRetorno / ((numConcept * (numConcept - 1)) / 2)) * 100).toFixed(1) + ' %')
                                if (condicaoDeRetorno == (numConcept * (numConcept - 1)) / 2) {
                                    resolve(mapa);
                                }
                            })
                        })
                    }
                }
            })
        })
    })
    //ANTES DE DELETAR OS ELEMENTOS COM DELETED = TRUE, TEM QUE FAZER UMA OUTRA PROMISE PARA PASSAR PELA NODEDATAARRAY EM BUSCA DE RELATION QUE NAO TENHA LINK COM NINGUEM
    promise1.then((resultado) => {
        console.log('TAm = ' + resultado.nodeDataArray.length)


        //promiseCleanNull tem como objetivo retornar os dados do object mapa somente quando for removido todos elementos null da array NodeDataArray
        let promiseCleanNull = new Promise((resolve, reject) => {

            for (var i = 0; i < resultado.nodeDataArray.length; i++) {

                if (resultado.nodeDataArray[i] == null) {
                    resultado.nodeDataArray.splice(i, 1); //tava mapa, troquei para resultado. caso de erro futuramente
                    i = i - 1
                }
                if (resultado.nodeDataArray[i].deleted == true) {
                    resultado.nodeDataArray.splice(i, 1); //tava mapa, troquei para resultado. caso de erro futuramente
                    i = i - 1
                }
                console.log('tam = ' + i + ' e ' + resultado.nodeDataArray.length)
                if (i == resultado.nodeDataArray.length - 1) {
                    resolve(resultado)
                }
            }

        })
        promiseCleanNull.then((resultadoFinal) => {

            console.log("\x1b[42m", "\x1b[37m", 'FIM ✓ ')
            res.json({
                resultadoFinal
            })
        })




    })
}



*/

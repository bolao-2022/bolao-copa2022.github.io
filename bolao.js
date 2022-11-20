import { FILES, MARGEM_SEGURANCA_PALPITES, tabela_versao } from './config.js';
import { now_ts } from './utils.js';

import * as bolao from './bolao.js';
window.bolao = bolao;

// lê arquivo da tabela
let tabela = await (await fetch(`${FILES}/tabela-1.json?v=2`)).json()
window.tabela = tabela;

// lê arquivo de palpites
let _palpites;
export async function get_palpites() {
    if (!_palpites) {
        _palpites = await (await fetch(`${FILES}/palpites-1.json?a=3`)).json();
        window.palpites = _palpites;
        Object.keys(_palpites).forEach(id_perfil => {
            _palpites[id_perfil].pontos = {};
            Object.keys(_palpites[id_perfil].palpites).forEach(jid => {
                let placar = tabela['jogos'][jid].placar;
                let palpite = _palpites[id_perfil].palpites[jid];
                _palpites[id_perfil].pontos[jid] = calcula_pontos(placar, palpite); // buscar do ranking ou da tabela com o placar
            });
        });
        delete _palpites['4fcc1b514ce7345b5e02d388403838f0a371bf2d'];
    }

    return _palpites;
}

let _userdata;
export async function userdata(pidx, reload = false) {
    if (!_userdata || reload) {
        // espera haver token disponível
        await new Promise(res => {
            function checa_token() {
                if (window.idToken) {
                    res();
                    return;
                }
                setTimeout(checa_token, 100);
            }
            checa_token();
        });
        let headers = {"Authorization": `Bearer ${window.idToken}`};
        let data = await (await fetch(`${API}?pidx=${pidx}`, {headers:headers})).json();
        _userdata = preprocess_userdata(data);
        window.udata = _userdata;
    }
    return _userdata;
}

function preprocess_userdata(_userdata) {
    // STUB

    // atualiza countdown global
    window.deadline_ts = now_ts() + _userdata.tempo - MARGEM_SEGURANCA_PALPITES;
    return _userdata;
}

function calcula_pontos(placar, palpite) {
    function ganhador(p) {
        if (p[0] > p[1]) {
            return "time1 ganhou";
        }
        else if (p[0] < p[1]) {
            return "time2 ganhour";
        }

        return "empate";
    }

    placar = placar.split(" ");
    palpite = palpite.split(" ");
    if (placar[0] == palpite[0] && placar[1] == palpite[1]) {
        return 6;
    } else if (ganhador(palpite) == ganhador(placar) && 
                (placar[0] == palpite[0] || placar[1] == palpite[1])) {
        return 3;
    } else if (ganhador(palpite) == ganhador(placar)) {
        return 2;
    }
    return 0;
}


window.get_palpite_salvo = get_palpite_salvo;
export async function get_palpite_salvo(email, pidx, jid) {
    let palpites = await bolao.get_palpites();
    if (jid in palpites) {
        // jogo encerrado pra palpites
        let id_perfil = `${email}:${pidx}`;
        return palpites[jid][id_perfil];
    }
    return null;
}

window.get_palpite_rascunho = get_palpite_rascunho;
export async function get_palpite_rascunho(pidx, jid) {
    let rascunho = (await bolao.userdata(pidx))?.perfil?.rascunho || {};
    if (Object.keys(rascunho).includes(String(jid))) {
        return rascunho[jid];
    }
    return null;
}

export async function salva_nick(pidx, nick) {
    let headers = {"Authorization": `Bearer ${window.idToken}`};
    let report = await (await fetch(`${API}/nick`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({pidx, nick})
    })).json();
    return report;
}

export async function salva_palpite(email, pidx, palpite) {
    console.log(`SALVAR palpite: ${palpite}`);
    console.log(`NO PERFIL: ${email}:${pidx}`);
    let headers = {"Authorization": `Bearer ${window.idToken}`};
    let data = await (await fetch(`${API}/palpites`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({pidx, ...palpite})
    })).json();
    return data;

}

export function get_jogo(jid) {
    let jogo = tabela.jogos[jid];
    if (!jogo)
        return {
           "jid": jid,
           "placar": null,
           "time1": null,
           "time2": null,
           "hora": null,
           "local": null,
           "grupo": null
        }
    // adiciona objeto Date
    jogo._hora = new Date(Date.parse(jogo.hora));
    jogo._localeDate = jogo._hora.toLocaleDateString('pt-BR', {day:'numeric', month:'short', year:'numeric', weekday:'long'});
    jogo._localeDate = jogo._localeDate.charAt(0).toUpperCase() + jogo._localeDate.slice(1);
    jogo._localeTime = jogo._hora.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});

    // adiciona urls das bandeiras
    jogo.band1 = tabela.paises[jogo?.time1]?.band;
    jogo.band2 = tabela.paises[jogo?.time2]?.band;

    // adiciona nomes dos países
    jogo.nome1 = tabela.paises[jogo?.time1]?.nome;
    jogo.nome2 = tabela.paises[jogo?.time2]?.nome;

    // adiciona hora pra screen
    return tabela.jogos[jid];
}

class BolaoJogo extends HTMLElement {
    constructor() {
        super();
        // só decomentar se decidirmos evoluir de
        // custom element pra um full web component
        //this.attachShadow({ mode: "open" });
        //this.$root = this.shadowRoot;
        this.$root = this;
    }
    connectedCallback() {
        this.jid = this.getAttribute("jid");
        this.jogo = bolao.get_jogo(this.jid);
        this.$root.innerHTML = `
            <div id="card">
                <div id="jid">Jogo ${this.jogo.jid}<br>Grupo ${this.jogo.grupo}</div>
                <div id="pais1">
                    <span id="sigla1">${this.jogo.time1}</span>
                    <span id="nome1">${this.jogo.nome1}</span>
                    <img id="band1" src="${this.jogo.band1}?tx=w_30">
                </div>
                <div id="inputs">
                    <input id="input1" size="2" value="${this.palpite1}" disabled>
                    &times;
                    <input id="input2" size="2" value="${this.palpite2}" disabled><br>
                </div>
                <div id="pais2">
                    <img id="band2" src="${this.jogo.band2}?tx=w_30">
                    <span id="nome2">${this.jogo.nome2}</span>
                    <span id="sigla2">${this.jogo.time2}</span>
                </div>
                <div id="extras" style="text-align: right;">
                    <span id="hora">${this.jogo._localeDate}</span><br>
                    <span id="hora">${this.jogo._localeTime}</span><br>
                    <span id="local">${this.jogo.local}</span>
                </div>
                <div></div>
                <div></div>
                <p id="saving"></p>
            </div>
            <div id="info-msg">
                <div id="info" style="display: none;">
                    Placar: <span id="placar1"></span>&times;<span id="placar2"></span><br>
                    Pontos acumulados: <span id="pontos">${this.pontos_acumulados()}</span><br>
                </div>
            </div>
        `;
        // coleta referências para os inputs
        this.$input1 = this.$root.querySelector("#input1");
        this.$input2 = this.$root.querySelector("#input2");
        this.$inputs = this.$root.querySelector("#inputs");
        this.$pontos = this.$root.querySelector("#pontos");
        this.$info = this.$root.querySelector("#info");
        this.$placar1 = this.$root.querySelector("#placar1");
        this.$placar2 = this.$root.querySelector("#placar2");

        // variáveis para configurar o componente
        let $card = this.$root.querySelector("#card");
        let $time1 = $card.querySelector("#time1");
        let $time2 = $card.querySelector("#time2");
        let $input1 = this.$input1;
        let $input2 = this.$input2;

        let beforeinput_handler = async (ev) => {
            let $inputX = ev.srcElement;

            // se não é caractere: permite
            // (pq é algum controle: tab, shift-tab, backspace, etc)
            if (!ev.data?.length) {
                return;
            }

            // ... é caractere!

            // se não é dígito: cancela
            if (/^\D$/.test(ev.data)) {
                ev.preventDefault();
                return;
            }

            // ... é dígito

            // se o value (ou parte dele) está selecionado: permite
            // (pq é apenas a substituição de um dígito)
            if ($inputX.selectionEnd > $inputX.selectionStart) {
                return;
            }

            // se o input já tem dois dígitos no value: cancela
            if ($inputX.value.length == 2) {
                ev.preventDefault();
                return;
            }
        }

        let input_handler = async (ev) => {
            let $inputX = ev.srcElement;

            // elimina 0 à esquerda
            $inputX.value = Number($inputX.value).toFixed(0);

            if (this._save_handler) {
                clearTimeout(this._save_handler);
                delete this._save_handler;
            }

            this._save_handler = setTimeout(function() {
                $inputX.blur();
            }, 4000);
        }

        let keyup_handler = (ev) => {
            ev.stopPropagation();
        }

        let change_handler = async (ev) => {
            let palpite = {
                jid: this.jid,
                palpite: this.get_palpite()
            };
            let $saving = this.$root.querySelector("#saving");
            $saving.innerText = "salvando...";
            let udata = await userdata(this.pidx);
            let resp = await salva_palpite(udata.email, udata.pidx, palpite);
            if (resp.ts) {
                udata.perfil.rascunho[this.jid] = resp.palpite;
                $saving.innerText = "palpite salvo";
                localStorage.setItem(`palpite-${this.jid}`, `${resp.palpite.replace(" ", "x")} (${resp.ts})`, )
                setTimeout(() => {
                    $saving.innerText = "";
                }, 1000);
            } else {
                $saving.innerHTML = `<span class="error-msg">ERRO: ${resp.error}</span>`;
                $input1.value = '';
                $input2.value = '';
            }
            const event = new CustomEvent('novo-palpite', {detail: resp});
            this.dispatchEvent(event);
            console.log(`novo palpite ${this.jid}: ${this.get_palpite()}`);
        };

        // configura componente
        if (!this.get_placar()) {
            $input1.disabled = false;
            $input2.disabled = false;
        }

        this.$inputs.addEventListener('click', ev => {
            ev.stopPropagation();
        });

        // limita o que pode ser digitado nos inputs de palpites
        $input1.addEventListener("beforeinput", beforeinput_handler);
        $input2.addEventListener("beforeinput", beforeinput_handler);

        // ajusta o valor após cada edição
        $input1.addEventListener("input", input_handler);
        $input2.addEventListener("input", input_handler);

        // processa após o usuário concluir a edição
        if (/^.*iphone.*$/gi.test(window.navigator?.platform)) {
            // deve ser um iphone
            console.log(">>>>>>>>>> iPhone");
            $input1.addEventListener("blur", change_handler);
            $input2.addEventListener("blur", change_handler);
        } else {
            // não deve ser um iphone
            console.log(">>>>>>>>>> NÃO é iPhone");
            $input1.addEventListener("change", change_handler);
            $input2.addEventListener("change", change_handler);
        }

        // evita que teclas nos inputs sejam interpretadas como filtragem
        $input1.addEventListener("keyup", keyup_handler);
        $input2.addEventListener("keyup", keyup_handler);
    }

    pontos_acumulados() {
         return 0;
    }

    get_palpite() {
        return `${this.$input1.value} ${this.$input2.value}`
    }

    is_editavel() {
        // STUB
        return !this.get_placar() && !window.site_bloqueado;
    }

    update() {
        let $input1 = this.$input1;
        let $input2 = this.$input2;
        let $inputs = this.$inputs;
        let $placar1 = this.$placar1;
        let $placar2 = this.$placar2;
        let $info = this.$info;

        // atualiza placar
        let placar = this.get_placar();
        if (placar) {
            $info.style.display = 'block';
            let [placar1, placar2] = placar.split(" ");
            $placar1.innerText = placar1;
            $placar2.innerText = placar2;
            // atualiza pontos
            // STUB: atualizar pontos aqui
            this.$pontos = 6;
        }

        // borda piscante se tempo tá acabando
        if (window.tempo > 0 && window.tempo < 10) {
            $inputs.classList.add("alerts-border");
        } else if (window.tempo < 0) {
            $inputs.classList.remove("alerts-border");
        }

        // atualiza editabilidade
        if (this.is_editavel()) {
            $input1.removeAttribute("disabled");
            $input2.removeAttribute("disabled");
        } else {
            $input1.setAttribute("disabled", true);
            $input2.setAttribute("disabled", true);
        }
    }
}

customElements.define("bolao-jogo", BolaoJogo);

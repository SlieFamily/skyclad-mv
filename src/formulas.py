# -*- coding: utf-8 -*-
"""Every formula in the film, as real LaTeX source.

texbuild.py compiles these with latex + dvisvgm into glyph outlines, so what
appears on screen is genuine TeX typesetting (Computer Modern, real fraction
rules, real limits), drawn as vector paths that can be revealed glyph by glyph.

\\tg{n}{...} tags a sub-expression (n = 1..9) so a shot can colour or animate
that part on its own: e.g. the |0> and |1> kets, or the phi a sequence converges to.
"""

FORMULAS = {
    # ---- 「０」が過去で 「１」が未来 / 「今」は何処にもない : the qubit --------
    "qubit":    r"|\psi\rangle = \alpha\,\tg{1}{|0\rangle} + \beta\,\tg{2}{|1\rangle}",
    "norm":     r"|\alpha|^2 + |\beta|^2 = 1",
    "born":     r"P(a) = \left|\langle a|\psi\rangle\right|^2",
    "collapse": r"|\psi\rangle \;\xrightarrow{\ \text{observe}\ }\; \tg{1}{|a_k\rangle}",

    # ---- 収束 : convergence, in the mathematical sense ------------------------
    "fibconv":  r"\lim_{n\to\infty}\frac{F_{n+1}}{F_n} = \tg{1}{\varphi} = \frac{1+\sqrt{5}}{2}",
    "fibrec":   r"F_{n+2} = F_{n+1} + F_{n}",
    "epsN":     r"\forall\varepsilon>0\;\exists N:\; n>N \Rightarrow |a_n - L| < \varepsilon",
    "basel":    r"\sum_{n=1}^{\infty}\frac{1}{n^2} = \frac{\pi^2}{6}",
    "fseries":  r"f(x) = \lim_{N\to\infty}\sum_{n=1}^{N}\frac{4}{\pi}\,\frac{\sin\big((2n-1)x\big)}{2n-1}",

    # ---- 並行する無数の線 : branching worlds / superposition ------------------
    "everett":  r"|\Psi\rangle = \sum_{i} c_i\,|O_i\rangle\otimes|s_i\rangle",
    "schrod":   r"i\hbar\frac{\partial}{\partial t}\Psi(x,t) = \hat{H}\,\Psi(x,t)",
    "superpos": r"\Psi = \sum_{n} c_n\,\psi_n\,e^{-iE_n t/\hbar}",

    # ---- 神の創り出した世界 / 絶対の均衡 ---------------------------------------
    "euler":    r"e^{i\pi} + 1 = 0",
    "efe":      r"G_{\mu\nu} + \Lambda g_{\mu\nu} = \frac{8\pi G}{c^4}\,T_{\mu\nu}",
    "alpha":    r"\alpha = \frac{e^2}{4\pi\varepsilon_0\hbar c} \approx \frac{1}{137}",

    # ---- 過去は離れて行き / 時間の概念 / 歪み ------------------------------------
    "entropy":  r"\frac{dS}{dt} \geq 0",
    "interval": r"ds^2 = -c^2\,dt^2 + dx^2 + dy^2 + dz^2",
    "dilation": r"\Delta t' = \frac{\Delta t}{\sqrt{1 - v^2/c^2}}",

    # ---- 果て / 絶対の領域 : the horizon ------------------------------------------
    "schw":     r"r_s = \frac{2GM}{c^2}",
    "schwmet":  r"d\tau^2 = \Big(1-\frac{r_s}{r}\Big)dt^2 - \frac{dr^2}{c^2\left(1-\frac{r_s}{r}\right)}",
    "planck":   r"\ell_P = \sqrt{\frac{\hbar G}{c^3}}",

    # ---- 偶然 / 招かれざる奇跡 / 背く事の出来ぬロジック -------------------------
    "uncert":   r"\Delta x\,\Delta p \geq \frac{\hbar}{2}",
    "noncon":   r"\neg\,(P \wedge \neg P)",

    # ---- 光速へと手を伸ばした / 想い出のパルス : Fourier ------------------------
    "fourier":  r"\hat{f}(\xi) = \int_{-\infty}^{\infty} f(x)\,e^{-2\pi i x\xi}\,dx",
    "energy":   r"E^2 = (pc)^2 + \big(mc^2\big)^2",

    # ---- 秩序のない理論 : chaos, the bifurcating map ------------------------------
    "logistic": r"x_{n+1} = r\,x_n\,(1 - x_n)",

    # ---- the observer in orbit (スカイクラッド) ---------------------------------
    "kepler":   r"T^2 = \frac{4\pi^2}{GM}\,a^3",

    # ---- ゲート : the gate that was guarded ------------------------------------------
    "hadamard": r"H = \frac{1}{\sqrt{2}}\begin{pmatrix} 1 & 1 \\ 1 & -1 \end{pmatrix}",
    "measure":  r"\langle\psi|\hat{M}|\psi\rangle",

    # ---- 無限と呼ばれた点と点 : Feigenbaum / the limits themselves --------------------
    "feig":     r"\delta = \lim_{n\to\infty}\frac{r_{n}-r_{n-1}}{r_{n+1}-r_{n}} = 4.6692\ldots",
    "phi":      r"\varphi = 1.6180339887\ldots",
    "baselN":   r"S_N = \sum_{n=1}^{N}\frac{1}{n^2} \;\longrightarrow\; \frac{\pi^2}{6}",
    "kets":     r"\tg{1}{|0\rangle}\;\;\tg{2}{|1\rangle}",
    "ket0":     r"|0\rangle",
    "ket1":     r"|1\rangle",
    "Hg":       r"H",
    "Mg":       r"\mathcal{M}",
}

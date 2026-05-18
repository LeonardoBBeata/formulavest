function permitir(...roles) {
  return (req, res, next) => {

    if (
      req.user.role ===
      "formulavest_master"
    ) {
      return next();
    }

    if (
      !roles.includes(req.user.role)
    ) {
      return res.status(403).json({
        error: "Sem permissão"
      });
    }

    next();
  };
}

module.exports = permitir;

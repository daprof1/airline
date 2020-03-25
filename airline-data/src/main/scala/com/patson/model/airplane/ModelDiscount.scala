package com.patson.model.airplane

import com.patson.data.airplane.ModelSource
import com.patson.model.airplane.Model.Type.{JUMBO, LARGE, LIGHT, MEDIUM, REGIONAL, SMALL, X_LARGE}

import scala.collection.mutable.ListBuffer

case class ModelDiscount(modelId : Int, discount : Double, discountType : DiscountType.Value, discountReason : DiscountReason.Value, expirationCycle : Option[Int]) {
  val description = discountReason match {
    case DiscountReason.FAVORITE => s"${(discount * 100).toInt}% off ${DiscountType.description(discountType)} for being the favorite model"
    case DiscountReason.LOW_DEMAND => s"${(discount * 100).toInt}% off ${DiscountType.description(discountType)} due to low demand"
  }
}

object ModelDiscount {
  val MAKE_FAVORITE_PERCENTAGE_THRESHOLD = 5 //5%
  val MAKE_FAVORITE_RESET_THRESHOLD = 52 //1 year at least

  val getFavoriteDiscounts: Model => List[ModelDiscount] = (model : Model) => {
    val constructionTimeDiscount = ModelDiscount(model.id, 0.25, DiscountType.CONSTRUCTION_TIME, DiscountReason.FAVORITE, None)
    val priceDiscount = model.airplaneType match {
      case LIGHT => 0.20
      case REGIONAL => 0.15
      case SMALL => 0.10
      case MEDIUM => 0.06
      case LARGE => 0.04
      case X_LARGE => 0.03
      case JUMBO => 0.02
    }
    List(ModelDiscount(model.id, priceDiscount, DiscountType.PRICE, DiscountReason.FAVORITE, None), constructionTimeDiscount)
  }

  /**
    * Get discounts including both specific to airline and those blanket to model
    * @param airlineId
    * @param modelId
    * @return
    */
  def getDiscounts(airlineId : Int, modelId : Int) : List[ModelDiscount] = {
    val discounts = ListBuffer[ModelDiscount]()
    //get airline specific discounts
    discounts.appendAll(ModelSource.loadAirlineDiscountsByAirlineIdAndModelId(airlineId, modelId))
    //get blanket model discounts
    discounts.appendAll(getDiscounts(modelId))
    discounts.toList
  }

  /**
    * Get discounts that is blanket to the model
    * @param modelId
    * @return
    */
  def getDiscounts(modelId : Int)  : List[ModelDiscount] = {
    val discounts = ListBuffer[ModelDiscount]()
    //get blanket model discounts
    discounts.appendAll(ModelSource.loadModelDiscountsByModelId(modelId))
    discounts.toList
  }


}



object DiscountReason extends Enumeration {
  type Type = Value
  val FAVORITE, LOW_DEMAND = Value
}

object DiscountType extends Enumeration {
  type Type = Value
  val PRICE, CONSTRUCTION_TIME = Value

  val description = (discountType : DiscountType.Value) => { discountType match {
      case PRICE => "Price"
      case CONSTRUCTION_TIME => "Construction Time"
      case _ => "Unknown"
    }
  }
}

